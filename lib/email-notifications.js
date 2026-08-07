import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

const FROM_EMAIL = process.env.EMAIL_FROM || 'AK Enterprises <onboarding@resend.dev>'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let _supabase = null
function db() {
  if (!_supabase && SUPABASE_URL && SUPABASE_KEY) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  }
  return _supabase
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0)
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function buildItemsRows(items) {
  if (!items?.length) return '<tr><td colspan="3" style="padding:12px;color:#666;text-align:center">No items</td></tr>'
  return items.map((item, i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333">${i + 1}. ${item.product_name_snapshot || item.name || 'Product'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:center">${item.quantity || 0}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:right">${formatCurrency((item.price_snapshot || item.price || 0) * (item.quantity || 1))}</td>
    </tr>
  `).join('')
}

function emailWrapper(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 32px;text-align:center">
          <h1 style="color:#f5c518;font-size:22px;margin:0;font-weight:800">AK Enterprises</h1>
          <p style="color:#aaa;font-size:11px;margin:4px 0 0;letter-spacing:1px">TRUSTED B2B PARTNER</p>
        </div>
        <div style="padding:32px">${content}</div>
        <div style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eee">
          <p style="color:#999;font-size:11px;margin:0">This is an automated notification from AK Enterprises</p>
          <p style="color:#999;font-size:11px;margin:4px 0 0">Pune, Maharashtra | akenterprises1411@gmail.com | +91 83088 60894</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function buildCustomerEmail(order, items, customerName, addressObj) {
  const addressStr = [
    addressObj.line1 || '',
    addressObj.line2 || '',
    `${addressObj.city || ''}, ${addressObj.state || ''} - ${addressObj.pincode || ''}`,
    addressObj.phone ? `Phone: ${addressObj.phone}` : ''
  ].filter(Boolean).join('<br/>')

  return emailWrapper(`
    <p style="color:#333;font-size:15px;line-height:1.5;margin:0 0 16px">Dear ${customerName},</p>
    <p style="color:#333;font-size:15px;line-height:1.5;margin:0 0 24px">Your order has been confirmed and is now being processed.</p>

    <table style="width:100%;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Order Number</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">#${order.order_number}</td></tr>
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Order Date</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${formatDate(order.placed_at || order.created_at)}</td></tr>
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Total Amount</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">${formatCurrency(order.total)}</td></tr>
    </table>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Items Ordered</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;font-weight:600">Product Name</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;font-weight:600">Quantity</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:right;font-weight:600">Price</th>
      </tr></thead>
      <tbody>${buildItemsRows(items)}</tbody>
    </table>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Shipping Address</h3>
    <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:24px;font-size:13px;color:#333;line-height:1.6">
      ${addressStr || 'No address provided'}
    </div>

    <p style="color:#555;font-size:13px;line-height:1.5;margin:0 0 24px">You can download your invoice by logging into your account.</p>
    <p style="color:#1a1a2e;font-weight:bold;font-size:13px;margin:0 0 24px">Thank you for choosing AK Enterprises</p>

    <div style="text-align:center;margin-top:24px">
      <a href="${BASE_URL}/orders/${order.id}" style="display:inline-block;background:#1a1a2e;color:#f5c518;text-decoration:none;padding:12px 32px;border-radius:24px;font-size:13px;font-weight:bold">View Order Details</a>
    </div>
  `)
}

function buildZonalAdminEmail(order, items, customerName, customerCompany, addressObj) {
  const addressStr = [
    addressObj.line1 || '',
    addressObj.line2 || '',
    `${addressObj.city || ''}, ${addressObj.state || ''} - ${addressObj.pincode || ''}`,
  ].filter(Boolean).join('<br/>')

  return emailWrapper(`
    <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 4px">Order Ready for Fulfillment 📦</h2>
    <p style="color:#333;font-size:14px;line-height:1.5;margin:0 0 24px">Order <strong>#${order.order_number}</strong> has been confirmed by AK Enterprises and is ready for dispatch.</p>

    <table style="width:100%;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Customer Name</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${customerName}</td></tr>
      ${customerCompany ? `<tr><td style="font-size:13px;color:#666;padding:4px 0">Company Name</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${customerCompany}</td></tr>` : ''}
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Phone</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${addressObj.phone || '—'}</td></tr>
    </table>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Shipping Address</h3>
    <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px;color:#333;line-height:1.6">
      ${addressStr || 'No address provided'}
    </div>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Items to Pack</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;font-weight:600">Product Name</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;font-weight:600">Quantity</th>
      </tr></thead>
      <tbody>
        ${items.map((item, i) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333">${i + 1}. ${item.product_name_snapshot || item.name || 'Product'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:center;font-weight:600">${item.quantity || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <p style="color:#333;font-size:14px;line-height:1.5;margin:0 0 24px">Please prepare and update the fulfillment status from your portal.</p>

    <div style="text-align:center;margin-top:24px">
      <a href="${BASE_URL}/vendor" style="display:inline-block;background:#1a1a2e;color:#f5c518;text-decoration:none;padding:12px 32px;border-radius:24px;font-size:13px;font-weight:bold">Open Zonal Admin Portal</a>
    </div>
  `)
}

function buildOwnerEmail(order, items, customerName, customerCompany, vendorName, confirmedTime) {
  return emailWrapper(`
    <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 4px">Order Confirmed ✅</h2>
    <p style="color:#333;font-size:14px;line-height:1.5;margin:0 0 24px">Order <strong>#${order.order_number}</strong> has been confirmed and is now being processed.</p>

    <table style="width:100%;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Customer Name</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${customerName}</td></tr>
      ${customerCompany ? `<tr><td style="font-size:13px;color:#666;padding:4px 0">Company Name</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${customerCompany}</td></tr>` : ''}
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Zonal Admin Assigned</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${vendorName || 'Not assigned'}</td></tr>
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Total Amount</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">${formatCurrency(order.total)}</td></tr>
      <tr><td style="font-size:13px;color:#666;padding:4px 0">Confirmed Timestamp</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${formatDate(confirmedTime)}</td></tr>
    </table>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Items Ordered</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;font-weight:600">Product Name</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;font-weight:600">Quantity</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:right;font-weight:600">Price</th>
      </tr></thead>
      <tbody>${buildItemsRows(items)}</tbody>
    </table>

    <p style="color:#666;font-size:12px;margin-top:24px">This is an automated confirmation record for your records.</p>

    <div style="text-align:center;margin-top:24px">
      <a href="${BASE_URL}/admin" style="display:inline-block;background:#1a1a2e;color:#f5c518;text-decoration:none;padding:12px 32px;border-radius:24px;font-size:13px;font-weight:bold">View in Admin Dashboard</a>
    </div>
  `)
}

// ─── Email Logger ────────────────────────────────────────────────────────────

async function logEmailResult(supabase, data) {
  if (!supabase) return
  try {
    await supabase.from('email_logs').insert({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
      ...data,
      created_at: new Date().toISOString()
    })
  } catch (e) {
    console.warn('[Email Log] Could not write to email_logs:', e?.message)
  }
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function sendOrderConfirmedEmails(orderIdOrObj, options = {}) {
  const supabase = options.supabaseClient || db()
  const results = { sent: 0, errors: [] }

  let orderId = typeof orderIdOrObj === 'string' ? orderIdOrObj : orderIdOrObj?.id
  if (!orderId) {
    console.error('[Email Notifications] No order ID provided')
    return { sent: 0, errors: ['No order ID provided'] }
  }

  if (!resend) {
    console.warn('[Email Notifications] RESEND_API_KEY is not configured — skipping emails')
    return { sent: 0, errors: ['Resend API key missing'] }
  }

  // Fetch full order details
  let fullOrder = null
  try {
    const { data: fetched, error: fetchErr } = await supabase
      .from('orders')
      .select('*, addresses(*), order_items(*, products(*))')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!fetched) {
      if (typeof orderIdOrObj === 'object') {
        fullOrder = orderIdOrObj
      } else {
        throw new Error('Order not found in database')
      }
    } else {
      fullOrder = fetched
    }
  } catch (e) {
    console.error('[Email Notifications] Failed to fetch full order:', e.message)
    if (typeof orderIdOrObj === 'object') {
      fullOrder = orderIdOrObj
    } else {
      return { sent: 0, errors: [e.message] }
    }
  }

  const items = fullOrder.order_items || fullOrder.items || []
  const addressObj = fullOrder.address || (Array.isArray(fullOrder.addresses) ? fullOrder.addresses[0] : (fullOrder.addresses || {}))
  const orderNumber = fullOrder.order_number || 'N/A'

  // Fetch Customer info
  let customerName = addressObj?.full_name || 'Customer'
  let customerEmail = fullOrder.user_email || null
  let customerCompany = null
  try {
    const { data: customerUser } = await supabase
      .from('users')
      .select('email, full_name, company_name')
      .eq('id', fullOrder.user_id)
      .maybeSingle()
    if (customerUser) {
      customerEmail = customerEmail || customerUser.email
      customerName = customerUser.full_name || customerName
      customerCompany = customerUser.company_name || null
    }
  } catch (e) {
    console.warn('[Email Notifications] Could not fetch customer info:', e.message)
  }

  // Fetch Zonal Admin info
  let vendorName = fullOrder.vendor_name || null
  let vendorEmail = fullOrder.vendor_email || null
  try {
    if (fullOrder.assigned_vendor_id) {
      const { data: vendorRecord } = await supabase
        .from('vendors')
        .select('name, email, user_id')
        .eq('id', fullOrder.assigned_vendor_id)
        .maybeSingle()
      if (vendorRecord) {
        vendorName = vendorName || vendorRecord.name
        vendorEmail = vendorEmail || vendorRecord.email
        if (!vendorEmail && vendorRecord.user_id) {
          const { data: vendorUser } = await supabase.from('users').select('email').eq('id', vendorRecord.user_id).maybeSingle()
          vendorEmail = vendorUser?.email || null
        }
      }
    }
  } catch (e) {
    console.warn('[Email Notifications] Could not fetch vendor info:', e.message)
  }

  // Fetch Owner Email
  let ownerEmail = 'akenterprises1411@gmail.com'
  try {
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
    if (settings && (settings.company_email || settings.contact_email)) {
      ownerEmail = settings.company_email || settings.contact_email || ownerEmail
    }
  } catch (e) {
    console.warn('[Email Notifications] Could not fetch settings for owner email:', e.message)
  }

  // Build recipients list
  const emails = []

  if (customerEmail) {
    emails.push({
      to: customerEmail,
      subject: `Order Confirmed — #${orderNumber} | AK Enterprises`,
      html: buildCustomerEmail(fullOrder, items, customerName, addressObj),
      recipientType: 'customer'
    })
  }

  if (vendorEmail) {
    emails.push({
      to: vendorEmail,
      subject: `Order Ready for Fulfillment — #${orderNumber}`,
      html: buildZonalAdminEmail(fullOrder, items, customerName, customerCompany, addressObj),
      recipientType: 'zonal_admin'
    })
  }

  if (ownerEmail) {
    emails.push({
      to: ownerEmail,
      subject: `Order Confirmed — #${orderNumber} | ${formatCurrency(fullOrder.total)}`,
      html: buildOwnerEmail(fullOrder, items, customerName, customerCompany, vendorName, fullOrder.updated_at || new Date().toISOString()),
      recipientType: 'owner'
    })
  }

  // Send via Resend API
  for (const email of emails) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email.to,
        subject: email.subject,
        html: email.html
      })

      if (error) throw error

      console.log(`[Resend Email] ✅ ${email.recipientType} → ${email.to} (id: ${data?.id})`)
      results.sent++

      await logEmailResult(supabase, {
        order_id: fullOrder.id,
        order_number: orderNumber,
        recipient_type: email.recipientType,
        recipient_email: email.to,
        subject: email.subject,
        status: 'sent'
      })
    } catch (e) {
      console.error(`[Resend Email] ❌ ${email.recipientType} → ${email.to}:`, e.message || e)
      results.errors.push(`${email.recipientType}: ${e.message || e}`)

      await logEmailResult(supabase, {
        order_id: fullOrder.id,
        order_number: orderNumber,
        recipient_type: email.recipientType,
        recipient_email: email.to,
        subject: email.subject,
        status: 'failed',
        error_message: e.message || String(e)
      })
    }
  }

  console.log(`[Resend Email] Done — ${results.sent}/${emails.length} sent for order #${orderNumber}`)
  return results
}
