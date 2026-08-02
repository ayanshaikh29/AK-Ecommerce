import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, type } = await req.json()
    if (!orderId || !type) {
      return new Response(JSON.stringify({ error: "Missing orderId or type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch order + user + items
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, addresses(*), users(email, full_name)')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found: " + (orderErr?.message || "") }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*, products(name)')
      .eq('order_id', orderId)

    if (itemsErr) {
      return new Response(JSON.stringify({ error: "Failed to fetch order items: " + itemsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Determine target recipient
    const recipientEmail = order.users?.email || order.vendor_email
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No recipient email found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const orderNum = order.order_number || orderId.slice(0, 8)
    const placedDate = new Date(order.placed_at || order.created_at).toLocaleDateString('en-IN')
    const formatINR = (n: number) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

    // Determine message contents by status type
    let statusSubject = ""
    let statusText = ""
    if (type === 'confirmed') {
      statusSubject = `Order Confirmed: #${orderNum}`
      statusText = "Your order has been approved by our admin team and is now being processed."
    } else if (type === 'shipped') {
      statusSubject = `Order Shipped! #${orderNum}`
      statusText = "Your package has been dispatched and is currently on its way to you."
    } else if (type === 'delivered') {
      statusSubject = `Order Delivered! #${orderNum}`
      statusText = "Your B2B supply package has been successfully delivered. Thank you for procuring with us."
    } else {
      statusSubject = `Order Status Update: #${orderNum}`
      statusText = `Your order status has been updated to ${type.toUpperCase()}.`
    }

    // Build items HTML table list
    const itemsTableRows = (items || []).map(it => {
      const name = it.product_name_snapshot || it.products?.name || "B2B Supply Item"
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eeeeee;">${name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eeeeee; text-align: center;">${it.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eeeeee; text-align: right;">${formatINR(it.price_snapshot)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eeeeee; text-align: right;">${formatINR(it.price_snapshot * it.quantity)}</td>
        </tr>
      `
    }).join('')

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; color: #333333; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
            <div style="text-align: center; border-bottom: 2px solid #500713; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="color: #500713; margin: 0; font-size: 24px;">AK ENTERPRISES</h1>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #666666; letter-spacing: 1px; font-weight: bold;">B2B OFFICE & INDUSTRIAL SUPPLIES</p>
            </div>
            
            <h2 style="color: #111111; font-size: 18px;">${statusSubject}</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #555555;">
              Dear ${order.users?.full_name || 'Business Partner'},
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #555555; font-weight: bold;">
              ${statusText}
            </p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 13px;">
              <table width="100%">
                <tr>
                  <td><strong>Order Number:</strong></td>
                  <td>#${orderNum}</td>
                </tr>
                <tr>
                  <td><strong>Order Date:</strong></td>
                  <td>${placedDate}</td>
                </tr>
                <tr>
                  <td><strong>Payment Mode:</strong></td>
                  <td>${order.payment_method || 'COD'}</td>
                </tr>
                <tr>
                  <td><strong>Delivery Address:</strong></td>
                  <td>${order.addresses?.line1 || ''}, ${order.addresses?.city || ''} (${order.addresses?.pincode || ''})</td>
                </tr>
              </table>
            </div>

            <h3 style="font-size: 14px; border-bottom: 1px solid #dddddd; padding-bottom: 8px; margin-top: 25px;">Items Summary</h3>
            <table width="100%" style="border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background-color: #f3f4f6; font-weight: bold;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Unit Price</th>
                  <th style="padding: 10px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsTableRows}
              </tbody>
            </table>

            <table width="100%" style="margin-top: 20px; font-size: 13px; border-top: 2px solid #eeeeee; padding-top: 10px;">
              <tr>
                <td width="60%"></td>
                <td width="40%">
                  <table width="100%">
                    <tr>
                      <td style="padding: 4px 0;">Subtotal:</td>
                      <td style="text-align: right; padding: 4px 0;">${formatINR(order.subtotal)}</td>
                    </tr>
                    ${order.discount > 0 ? `
                    <tr>
                      <td style="padding: 4px 0; color: #059669;">Discount:</td>
                      <td style="text-align: right; padding: 4px 0; color: #059669;">-${formatINR(order.discount)}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding: 4px 0;">Shipping Fee:</td>
                      <td style="text-align: right; padding: 4px 0;">${order.shipping_fee > 0 ? formatINR(order.shipping_fee) : 'Free'}</td>
                    </tr>
                    <tr style="font-weight: bold; font-size: 15px; color: #500713;">
                      <td style="padding: 8px 0; border-top: 1px solid #dddddd;">Grand Total:</td>
                      <td style="text-align: right; padding: 8px 0; border-top: 1px solid #dddddd;">${formatINR(order.total)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <div style="margin-top: 40px; border-top: 1px solid #eeeeee; padding-top: 20px; text-align: center; font-size: 11px; color: #999999;">
              <p>This is an automated notification from AK Enterprises.</p>
              <p>Pune, Maharashtra, India. Support: support@akenterprises.com</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Connect and send via SMTP relay
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Deno.env.get('SMTP_PORT')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.warn("SMTP environment variables are not fully configured. Logging email instead.");
      console.log(`[SMTP SIMULATED EMAIL] To: ${recipientEmail}, Subject: ${statusSubject}`);
      return new Response(JSON.stringify({ message: "SMTP credentials missing. Simulated success.", simulated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const smtpClient = new SmtpClient()
    await smtpClient.connectTS({
      hostname: smtpHost,
      port: Number(smtpPort),
      username: smtpUser,
      password: smtpPass,
      secure: Number(smtpPort) === 465
    })

    await smtpClient.send({
      from: `"AK Enterprises" <${smtpUser}>`,
      to: recipientEmail,
      subject: statusSubject,
      html: emailHtml
    })

    await smtpClient.close()

    return new Response(JSON.stringify({ success: true, message: `Email sent successfully to ${recipientEmail}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("[Email Edge Function Execution Error]:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
