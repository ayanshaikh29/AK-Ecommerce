import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// ─── Gmail SMTP Config ───────────────────────────────────────────────────────
// Environment variables needed:
//   GMAIL_USER     = your Gmail address (e.g., akenterprises1411@gmail.com)
//   GMAIL_APP_PASS = 16-character App Password (NOT your regular password)
//   EMAIL_FROM     = display name + email (e.g., "AK Enterprises <akenterprises1411@gmail.com>")
//   NEXT_PUBLIC_BASE_URL = your website URL
//
// Gmail App Password kaise banaye:
//   1. Google Account → Security → 2-Step Verification → ON karo
//   2. Google Account → Security → App Passwords → Select app "Mail" → Generate
//   3. Jo 16-character code milega woh GMAIL_APP_PASS me daalo

const GMAIL_USER = process.env.GMAIL_USER || ''
const GMAIL_PASS = process.env.GMAIL_APP_PASS || ''
const FROM_EMAIL = process.env.EMAIL_FROM || `AK Enterprises <${GMAIL_USER}>`
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

let _transporter = null
function transporter() {
  if (!_transporter && GMAIL_USER && GMAIL_PASS) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
      }
    })
  }
  return _transporter
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

function buildCustomerEmail(order, items, customerName) {
  return emailWrapper(`
    <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 4px">Order Confirmed ✅</h2>
    <p style="color:#666;font-size:13px;margin:0 0 24px">Thank you, <strong>${customerName}</strong>! Your order has been confirmed and is being processed.</p>

    <table style="width:100%;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Order Number</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">#${order.order_number}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Order Date</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${formatDate(order.placed_at || order.created_at)}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Payment Method</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${order.payment_method || 'COD'}</td></tr>
    </table>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Order Items</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;font-weight:600">Item</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;font-weight:600">Qty</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:right;font-weight:600">Amount</th>
      </tr></thead>
      <tbody>${buildItemsRows(items)}</tbody>
    </table>

    <table style="width:100%;margin-bottom:24px">
      <tr><td style="font-size:14px;font-weight:bold;color:#1a1a2e;padding:8px 0;border-top:2px solid #1a1a2e">Total Amount</td>
      <td style="font-size:16px;font-weight:bold;color:#1a1a2e;text-align:right;padding:8px 0;border-top:2px solid #1a1a2e">${formatCurrency(order.total)}</td></tr>
    </table>

    <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="margin:0;font-size:13px;color:#2e7d32"><strong>📦 Next Steps:</strong></p>
      <p style="margin:8px 0 0;font-size:13px;color:#333">Your order is now being processed and will be shipped soon. You will receive a notification once it is dispatched.</p>
    </div>

    <div style="text-align:center;margin-top:24px">
      <a href="${BASE_URL}/orders/${order.id}" style="display:inline-block;background:#1a1a2e;color:#f5c518;text-decoration:none;padding:12px 32px;border-radius:24px;font-size:13px;font-weight:bold">View Order & Download Invoice</a>
    </div>
  `)
}

function buildZonalAdminEmail(order, items, customerName, customerCompany) {
  return emailWrapper(`
    <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 4px">Order Ready for Dispatch 📦</h2>
    <p style="color:#666;font-size:13px;margin:0 0 24px">Order <strong>#${order.order_number}</strong> has been confirmed by the Owner. Please prepare for dispatch.</p>

    <table style="width:100%;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Order Number</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">#${order.order_number}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Customer</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${customerName}${customerCompany ? ` (${customerCompany})` : ''}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Order Total</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">${formatCurrency(order.total)}</td></tr>
    </table>

    ${order.address ? `
    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Shipping Address</h3>
    <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px;color:#333;line-height:1.6">
      ${order.address.full_name || customerName}<br/>
      ${order.address.line1 || ''}${order.address.line2 ? `, ${order.address.line2}` : ''}<br/>
      ${order.address.city || ''}, ${order.address.state || ''} - ${order.address.pincode || ''}
      ${order.address.phone ? `<br/>Phone: ${order.address.phone}` : ''}
    </div>` : ''}

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Items to Fulfill</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;font-weight:600">Item</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;font-weight:600">Qty</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:right;font-weight:600">Amount</th>
      </tr></thead>
      <tbody>${buildItemsRows(items)}</tbody>
    </table>

    <div style="background:#fff3e0;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="margin:0;font-size:13px;color:#e65100"><strong>⚡ Action Required:</strong></p>
      <p style="margin:8px 0 0;font-size:13px;color:#333">Please prepare the items for dispatch. Update the order status to "Packed" once ready.</p>
    </div>

    <div style="text-align:center;margin-top:24px">
      <a href="${BASE_URL}/vendor" style="display:inline-block;background:#1a1a2e;color:#f5c518;text-decoration:none;padding:12px 32px;border-radius:24px;font-size:13px;font-weight:bold">Open Zonal Admin Portal</a>
    </div>
  `)
}

function buildOwnerEmail(order, items, customerName, customerCompany, vendorName) {
  return emailWrapper(`
    <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 4px">Order Confirmed ✅</h2>
    <p style="color:#666;font-size:13px;margin:0 0 24px">Order <strong>#${order.order_number}</strong> has been confirmed and is now being processed.</p>

    <table style="width:100%;background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px">
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Order Number</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">#${order.order_number}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Customer</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${customerName}${customerCompany ? ` (${customerCompany})` : ''}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Zonal Admin</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${vendorName || 'Not assigned'}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Order Total</td><td style="font-size:13px;font-weight:bold;color:#1a1a2e;text-align:right;padding:4px 0">${formatCurrency(order.total)}</td></tr>
      <tr><td style="font-size:12px;color:#666;padding:4px 0">Confirmed At</td><td style="font-size:13px;color:#333;text-align:right;padding:4px 0">${formatDate(order.updated_at || new Date().toISOString())}</td></tr>
    </table>

    <h3 style="color:#1a1a2e;font-size:14px;margin:0 0 8px">Order Items</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:left;font-weight:600">Item</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:center;font-weight:600">Qty</th>
        <th style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#666;text-align:right;font-weight:600">Amount</th>
      </tr></thead>
      <tbody>${buildItemsRows(items)}</tbody>
    </table>

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

export async function sendOrderConfirmedEmails(order, options = {}) {
  const gmailUser = GMAIL_USER
  const gmailPass = GMAIL_PASS

  if (!gmailUser || !gmailPass) {
    console.warn('[Email Notifications] GMAIL_USER / GMAIL_APP_PASS not configured — skipping emails')
    return { sent: 0, errors: ['Gmail credentials not configured'] }
  }

  const tx = transporter()
  if (!tx) {
    console.warn('[Email Notifications] Gmail transporter not initialized — skipping emails')
    return { sent: 0, errors: ['Transporter not initialized'] }
  }

  const supabase = options.supabaseClient || db()
  const results = { sent: 0, errors: [] }

  // Fetch full order data with joins if not already joined
  let fullOrder = order
  if (!order.order_items || !order.addresses) {
    try {
      const { data: fetched } = await supabase
        .from('orders')
        .select('*, addresses(*), order_items(*, products(*))')
        .eq('id', order.id)
        .maybeSingle()
      if (fetched) fullOrder = fetched
    } catch (e) {
      console.error('[Email Notifications] Failed to fetch full order:', e.message)
    }
  }

  const items = fullOrder.order_items || order.items || []
  const address = Array.isArray(fullOrder.addresses) ? fullOrder.addresses[0] : (fullOrder.addresses || order.address || {})

  // Fetch customer info
  let customerName = address?.full_name || 'Customer'
  let customerEmail = fullOrder.user_email || null
  let customerCompany = null
  try {
    const { data: customerUser } = await supabase
      .from('users').select('email, full_name, company_name').eq('id', fullOrder.user_id).maybeSingle()
    if (customerUser) {
      customerEmail = customerEmail || customerUser.email
      customerName = customerUser.full_name || customerName
      customerCompany = customerUser.company_name || null
    }
  } catch (e) {
    console.warn('[Email Notifications] Could not fetch customer info:', e.message)
  }

  // Fetch zonal admin info
  let vendorName = fullOrder.vendor_name || null
  let vendorEmail = fullOrder.vendor_email || null
  try {
    if (fullOrder.assigned_vendor_id) {
      const { data: vendorRecord } = await supabase
        .from('vendors').select('name, email, user_id').eq('id', fullOrder.assigned_vendor_id).maybeSingle()
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

  // Fetch owner email
  let ownerEmail = null
  try {
    const { data: ownerUser } = await supabase.from('users').select('email').eq('role', 'admin').limit(1).maybeSingle()
    ownerEmail = ownerUser?.email || null
  } catch (e) {
    console.warn('[Email Notifications] Could not fetch owner email:', e.message)
  }

  const orderNumber = fullOrder.order_number || order.order_number || 'N/A'

  // Build email list
  const emails = []

  if (customerEmail) {
    emails.push({
      to: customerEmail,
      subject: `Order Confirmed — #${orderNumber} | AK Enterprises`,
      html: buildCustomerEmail(fullOrder, items, customerName),
      recipientType: 'customer'
    })
  }

  if (vendorEmail) {
    emails.push({
      to: vendorEmail,
      subject: `Order Confirmed for Processing — #${orderNumber}`,
      html: buildZonalAdminEmail(fullOrder, items, customerName, customerCompany),
      recipientType: 'zonal_admin'
    })
  }

  if (ownerEmail) {
    emails.push({
      to: ownerEmail,
      subject: `Order Confirmed — #${orderNumber} | ${formatCurrency(fullOrder.total)}`,
      html: buildOwnerEmail(fullOrder, items, customerName, customerCompany, vendorName),
      recipientType: 'owner'
    })
  }

  // Send emails via Gmail SMTP
  for (const email of emails) {
    try {
      const info = await tx.sendMail({
        from: FROM_EMAIL,
        to: email.to,
        subject: email.subject,
        html: email.html
      })

      console.log(`[Email] ✅ ${email.recipientType} → ${email.to} (messageId: ${info.messageId})`)
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
      console.error(`[Email] ❌ ${email.recipientType} → ${email.to}:`, e.message)
      results.errors.push(`${email.recipientType}: ${e.message}`)

      await logEmailResult(supabase, {
        order_id: fullOrder.id,
        order_number: orderNumber,
        recipient_type: email.recipientType,
        recipient_email: email.to,
        subject: email.subject,
        status: 'failed',
        error_message: e.message
      })
    }
  }

  console.log(`[Email] Done — ${results.sent}/${emails.length} sent for order #${orderNumber}`)
  return results
}
