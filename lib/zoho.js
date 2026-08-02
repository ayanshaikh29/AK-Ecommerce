import https from 'https'
import querystring from 'querystring'

const ZOHO_API = 'www.zohoapis.in'
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID || ''

// --- Token Refresher ---
let _cachedToken = null
let _tokenExpiresAt = 0

export async function getZohoAccessToken() {
  const now = Date.now()
  if (_cachedToken && now < _tokenExpiresAt - 60000) return _cachedToken

  const postData = querystring.stringify({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token'
  })

  const data = await httpsPost('accounts.zoho.in', '/oauth/v2/token', postData, {
    'Content-Type': 'application/x-www-form-urlencoded'
  })

  if (!data.access_token) {
    console.error('[Zoho OAuth Error] Token refresh response payload:', JSON.stringify(data))
    throw new Error('oauth_expired')
  }

  _cachedToken = data.access_token
  _tokenExpiresAt = now + (data.expires_in || 3600) * 1000
  return _cachedToken
}

// --- Generic HTTPS helpers ---
function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
    }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
    })
    req.on('error', reject)
    req.end()
  })
}

function httpsGetBuffer(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), statusCode: res.statusCode, headers: res.headers }))
    })
    req.on('error', reject)
    req.end()
  })
}

// --- Logging & Retry Wrapper ---
async function withRetry(operationName, fn, retries = 3, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        console.warn(`[Zoho API Retry] Retrying "${operationName}" (Attempt ${i}/${retries}) in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
      }
      return await fn()
    } catch (err) {
      console.error(`[Zoho API Error] "${operationName}" failed (Attempt ${i + 1}/${retries + 1}):`, err.message)
      if (i === retries) throw err
    }
  }
}

async function zohoGet(path) {
  const op = `GET ${path}`
  console.log(`[Zoho API Request] ${op}`)
  return withRetry(op, async () => {
    const token = await getZohoAccessToken()
    const res = await httpsGet(ZOHO_API, `/books/v3${path}?organization_id=${ZOHO_ORG_ID}`, {
      Authorization: `Zoho-oauthtoken ${token}`
    })
    console.log(`[Zoho API Response] ${op} status: ${res?.code === 0 ? 'success' : 'code ' + res?.code}`)
    return res
  })
}

async function zohoPost(path, body) {
  const op = `POST ${path}`
  console.log(`[Zoho API Request] ${op} Payload:`, JSON.stringify(body))
  return withRetry(op, async () => {
    const token = await getZohoAccessToken()
    const bodyStr = JSON.stringify(body)
    const res = await httpsPost(ZOHO_API, `/books/v3${path}?organization_id=${ZOHO_ORG_ID}`, bodyStr, {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    })
    console.log(`[Zoho API Response] ${op} status: ${res?.code === 0 ? 'success' : 'code ' + res?.code} Data:`, JSON.stringify(res))
    return res
  })
}

async function zohoGetPdf(path) {
  const op = `GET PDF ${path}`
  console.log(`[Zoho API Request] ${op}`)
  return withRetry(op, async () => {
    const token = await getZohoAccessToken()
    const res = await httpsGetBuffer(ZOHO_API, `/books/v3${path}?organization_id=${ZOHO_ORG_ID}&accept=pdf`, {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: 'application/pdf'
    })
    console.log(`[Zoho API Response] ${op} status: ${res.statusCode}`)
    return res
  })
}

// --- Contact Sync ---
export async function syncZohoContact(customer) {
  // customer: { email, full_name, phone, gst_number, shipping_address }
  try {
    // Try to find existing contact by email
    const search = await zohoGet(`/contacts?email=${encodeURIComponent(customer.email)}`)
    const existing = search?.contacts?.find(c => c.email === customer.email)
    if (existing) return existing.contact_id

    // Create new contact
    const addr = customer.shipping_address || {}
    const payload = {
      contact_name: customer.full_name || customer.email,
      contact_type: 'customer',
      email: customer.email,
      phone: customer.phone || '',
      gst_no: customer.gst_number || '',
      billing_address: {
        address: addr.line1 || addr.address_line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        zip: addr.pincode || addr.postal_code || '',
        country: 'India'
      }
    }
    const res = await zohoPost('/contacts', { contact: payload })
    if (res?.contact?.contact_id) return res.contact.contact_id
    throw new Error('Contact creation failed: ' + JSON.stringify(res))
  } catch (e) {
    console.error('[Zoho Contact Sync Error]', e.message)
    throw e
  }
}

// --- Invoice Creation ---
export async function createZohoInvoice({ order, contactId }) {
  // VALIDATION: reject if no valid items (prevents zero-value invoices)
  const validItems = (order.items || []).filter(it => (it.price_snapshot || 0) > 0 && (it.quantity || 0) > 0)
  if (validItems.length === 0) {
    throw new Error('Cannot create Zoho invoice: no line items with valid non-zero prices')
  }

  // Determine GST type: IGST if customer is outside Maharashtra, otherwise CGST+SGST
  const addr = order.shipping_address || {}
  const customerState = (addr.state || '').trim().toUpperCase()
  const isInterState = customerState !== 'MAHARASHTRA' && customerState !== 'MH'

  const lineItems = validItems.map(item => ({
    name: item.product_name_snapshot,
    description: item.product_name_snapshot,
    quantity: item.quantity,
    rate: item.price_snapshot,
    hsn_or_sac: item.hsn_code || '',
    tax_name: isInterState ? 'IGST' : 'GST',
  }))

  const payload = {
    invoice: {
      customer_id: contactId,
      reference_number: order.order_number,
      date: new Date().toISOString().slice(0, 10),
      payment_terms: 0,
      notes: `Order #${order.order_number}`,
      terms: 'Thank you for your business.',
      shipping_address: {
        address: addr.line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        zip: addr.pincode || '',
        country: 'India'
      },
      line_items: lineItems,
      is_inclusive_tax: false
    }
  }

  try {
    const res = await zohoPost('/invoices', payload)
    if (res?.invoice?.invoice_id) {
      return {
        invoice_id: res.invoice.invoice_id,
        invoice_number: res.invoice.invoice_number,
        customer_id: res.invoice.customer_id,
        contact_id: res.invoice.customer_id,
        pdf_url: `/api/zoho/invoice/${res.invoice.invoice_id}`,
        status: res.invoice.status,
        created_time: res.invoice.created_time || new Date().toISOString(),
        last_modified_time: res.invoice.last_modified_time || new Date().toISOString()
      }
    }
    throw new Error('Invoice creation failed: ' + JSON.stringify(res))
  } catch (e) {
    console.error('[Zoho Invoice Creation Error]', e.message)
    throw e
  }
}

// --- Delivery Challan Creation ---
export async function createZohoChallan({ order, contactId }) {
  const validItems = (order.items || []).filter(it => (it.quantity || 0) > 0)
  if (validItems.length === 0) {
    console.warn('[Zoho Challan] No valid items to include in challan')
    return null
  }

  const addr = order.shipping_address || {}

  const lineItems = validItems.map(item => ({
    name: item.product_name_snapshot,
    description: item.product_name_snapshot,
    quantity: item.quantity,
    rate: 0, // Challan shows NO pricing — just product + quantity
    hsn_or_sac: item.hsn_code || ''
  }))

  const payload = {
    delivery_challan: {
      customer_id: contactId,
      reference_number: `DC-${order.order_number}`,
      date: new Date().toISOString().slice(0, 10),
      notes: `Delivery Challan for Order #${order.order_number}`,
      // Shipping address for delivery purposes
      shipping_address: {
        address: addr.line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        zip: addr.pincode || '',
        country: 'India'
      },
      line_items: lineItems
    }
  }

  try {
    const res = await zohoPost('/deliverychallans', payload)
    if (res?.delivery_challan?.challan_id) return res.delivery_challan.challan_id
    // Some Zoho plans may not support delivery challan endpoint
    console.warn('[Zoho Challan] Endpoint may not be available on this plan:', JSON.stringify(res))
    return null
  } catch (e) {
    console.error('[Zoho Challan Creation Error]', e.message)
    return null // Non-fatal
  }
}

// --- PDF Fetcher ---
export async function getZohoInvoicePdf(invoiceId) {
  return zohoGetPdf(`/invoices/${invoiceId}`)
}

export async function getZohoChallanPdf(challanId) {
  return zohoGetPdf(`/deliverychallans/${challanId}`)
}
