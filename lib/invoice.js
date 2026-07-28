import html2pdf from 'html2pdf.js';

const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export const downloadInvoice = (order) => {
  const status = (order.status || 'pending').toLowerCase()
  let statusBg = '#FEF3C7'
  let statusColor = '#92400E'
  let statusBorder = '#FDE68A'
  let statusLabel = 'PENDING'

  if (status === 'delivered' || order.payment_status === 'paid') {
    statusBg = '#D1FAE5'
    statusColor = '#065F46'
    statusBorder = '#A7F3D0'
    statusLabel = 'PAID'
  } else if (status === 'confirmed' || status === 'shipped' || status === 'packed') {
    statusBg = '#DBEAFE'
    statusColor = '#1E40AF'
    statusBorder = '#BFDBFE'
    statusLabel = status.toUpperCase()
  } else if (status === 'cancelled' || status === 'rejected') {
    statusBg = '#FEE2E2'
    statusColor = '#991B1B'
    statusBorder = '#FCA5A5'
    statusLabel = status.toUpperCase()
  }

  const orderDate = new Date(order.placed_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  const itemRows = (order.items || []).map((it, idx) => `
    <tr style="${idx % 2 === 1 ? 'background-color:#F9FAFB;' : 'background-color:#FFFFFF;'}">
      <td style="padding:10px 12px; border-bottom:1px solid #E5E7EB; font-size:11.5px; color:#111827; font-weight:500;">${it.product_name_snapshot}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #E5E7EB; text-align:right; font-size:11.5px; color:#374151;">${formatINR(it.price_snapshot)}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #E5E7EB; text-align:center; font-size:11.5px; color:#374151; font-weight:600;">${it.quantity}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #E5E7EB; text-align:right; font-size:11.5px; font-weight:700; color:#111827;">${formatINR(it.price_snapshot * it.quantity)}</td>
    </tr>
  `).join('')

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111827;
            background: #FFFFFF;
            font-size: 12px;
            line-height: 1.5;
          }
          .page { padding: 40px 48px; }
        </style>
      </head>
      <body>
        <div class="page">

          <!-- TOP HEADER WITH AK BRAND LOGO MARK -->
          <table width="100%" style="margin-bottom:20px; border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <table style="border-collapse:collapse;">
                  <tr>
                    <td style="padding-right:12px; vertical-align:middle;">
                      <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, #d4af37 0%, #8b0000 100%); color:#FFFFFF; font-weight:900; font-size:18px; text-align:center; line-height:40px; font-family:Arial, sans-serif; border:2px solid #D4AF37;">AK</div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:22px; font-weight:900; color:#500713; letter-spacing:-0.5px; line-height:1.1;">AK ENTERPRISES</div>
                      <div style="font-size:8.5px; color:#6B7280; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-top:2px;">B2B Office & Industrial Supplies</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:10px; font-size:10.5px; color:#4B5563; line-height:1.7;">
                  B2B Warehousing Hub, Sector 4<br/>
                  Pune, Maharashtra – 411001<br/>
                  GSTIN: 27AAAAA1111A1Z1<br/>
                  billing@akenterprises.com
                </div>
              </td>
              <td style="vertical-align:top; text-align:right;">
                <div style="font-size:26px; font-weight:900; color:#500713; text-transform:uppercase; letter-spacing:1px;">TAX INVOICE</div>
                <table style="margin-top:8px; margin-left:auto; border-collapse:collapse;">
                  <tr>
                    <td style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; padding:3px 0; padding-right:12px; font-weight:600;">Invoice No.</td>
                    <td style="font-size:11px; font-weight:800; color:#111827; padding:3px 0;">INV-${order.order_number}</td>
                  </tr>
                  <tr>
                    <td style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; padding:3px 0; padding-right:12px; font-weight:600;">Invoice Date</td>
                    <td style="font-size:11px; font-weight:800; color:#111827; padding:3px 0;">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; padding:3px 0; padding-right:12px; font-weight:600;">Order Ref.</td>
                    <td style="font-size:11px; font-weight:800; color:#111827; padding:3px 0;">#${order.order_number}</td>
                  </tr>
                  <tr>
                    <td style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; padding:3px 0; padding-right:12px; font-weight:600;">Payment</td>
                    <td style="font-size:11px; font-weight:800; color:#111827; padding:3px 0;">${order.payment_method || 'Cash on Delivery'}</td>
                  </tr>
                  <tr>
                    <td style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; padding:4px 0; padding-right:12px; font-weight:600;">Status</td>
                    <td style="padding:4px 0;">
                      <span style="font-size:10px; font-weight:800; padding:3px 12px; border-radius:12px; background:${statusBg}; color:${statusColor}; border:1px solid ${statusBorder}; letter-spacing:0.5px; display:inline-block;">${statusLabel}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- BRAND GOLD/MAROON ACCENT HORIZONTAL DIVIDER -->
          <div style="height:3px; background:linear-gradient(90deg, #500713 0%, #D4AF37 50%, #500713 100%); margin-bottom:20px; border-radius:2px;"></div>

          <!-- BILLING / SHIPPING -->
          <table width="100%" style="margin-bottom:24px; border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top; width:60%; padding-right:24px;">
                <div style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:#500713; margin-bottom:6px;">Bill To / B2B Client</div>
                <div style="font-size:14px; font-weight:800; color:#111827; margin-bottom:3px;">${order.address?.full_name || '—'}</div>
                <div style="font-size:11px; color:#4B5563; line-height:1.7;">
                  Phone: ${order.address?.phone || '—'}<br/>
                  ${order.address?.line1 || ''}${order.address?.line2 ? '<br/>' + order.address.line2 : ''}<br/>
                  ${order.address?.city || ''}, ${order.address?.state || ''} – ${order.address?.pincode || ''}
                  ${order.address?.gst ? `<br/><strong style="color:#500713;">GSTIN: ${order.address.gst}</strong>` : ''}
                </div>
              </td>
            </tr>
          </table>

          <!-- ITEMS TABLE WITH ALTERNATING ROW SHADING -->
          <table width="100%" style="border-collapse:collapse; margin-bottom:20px;">
            <thead>
              <tr style="background:#500713;">
                <th style="padding:10px 12px; text-align:left; font-size:9.5px; text-transform:uppercase; letter-spacing:0.8px; color:#FFFFFF; font-weight:700; width:50%;">Item Description</th>
                <th style="padding:10px 12px; text-align:right; font-size:9.5px; text-transform:uppercase; letter-spacing:0.8px; color:#FFFFFF; font-weight:700; width:18%;">Unit Price</th>
                <th style="padding:10px 12px; text-align:center; font-size:9.5px; text-transform:uppercase; letter-spacing:0.8px; color:#FFFFFF; font-weight:700; width:12%;">Qty</th>
                <th style="padding:10px 12px; text-align:right; font-size:9.5px; text-transform:uppercase; letter-spacing:0.8px; color:#FFFFFF; font-weight:700; width:20%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <!-- TOTALS WITH MAROON GRAND TOTAL ROW -->
          <table width="100%" style="border-collapse:collapse; margin-bottom:28px;">
            <tr>
              <td width="50%"></td>
              <td width="50%">
                <table width="100%" style="border-collapse:collapse; border:1px solid #E5E7EB; border-radius:8px; overflow:hidden;">
                  <tr style="background:#F9FAFB;">
                    <td style="padding:8px 14px; font-size:11px; color:#6B7280; font-weight:600;">Gross Subtotal</td>
                    <td style="padding:8px 14px; text-align:right; font-size:11px; color:#111827; font-weight:700;">${formatINR(order.subtotal)}</td>
                  </tr>
                  ${order.discount > 0 ? `
                  <tr>
                    <td style="padding:8px 14px; font-size:11px; color:#059669; font-weight:600; border-top:1px solid #E5E7EB;">Trade Discount</td>
                    <td style="padding:8px 14px; text-align:right; font-size:11px; color:#059669; font-weight:700; border-top:1px solid #E5E7EB;">−${formatINR(order.discount)}</td>
                  </tr>` : ''}
                  <tr style="background:#F9FAFB;">
                    <td style="padding:8px 14px; font-size:11px; color:#6B7280; font-weight:600; border-top:1px solid #E5E7EB;">Delivery Charges</td>
                    <td style="padding:8px 14px; text-align:right; font-size:11px; color:#111827; font-weight:700; border-top:1px solid #E5E7EB;">${order.shipping_fee > 0 ? formatINR(order.shipping_fee) : 'Free'}</td>
                  </tr>
                  <tr style="background:#500713;">
                    <td style="padding:12px 14px; font-size:13px; font-weight:900; color:#FCD34D; text-transform:uppercase; letter-spacing:0.5px;">Grand Total</td>
                    <td style="padding:12px 14px; text-align:right; font-size:16px; font-weight:900; color:#FFFFFF;">${formatINR(order.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- BOTTOM ACCENT DIVIDER -->
          <div style="height:2px; background:linear-gradient(90deg, #500713 0%, #D4AF37 50%, #500713 100%); margin-bottom:16px; border-radius:2px;"></div>

          <!-- FOOTER -->
          <table width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="font-size:9.5px; color:#6B7280; line-height:1.8;">
                <strong style="color:#374151;">Terms & Conditions:</strong> Payment due on delivery for COD orders. For bank transfers, please use the order number as reference.
                Returns accepted within 7 days of delivery subject to product condition. GSTIN required for B2B invoice amendment requests.
              </td>
              <td style="text-align:right; vertical-align:top; font-size:9.5px; color:#6B7280; white-space:nowrap; padding-left:20px; line-height:1.8;">
                support@akenterprises.com<br/>
                www.akenterprises.com<br/>
                Pune, Maharashtra, India
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:12px; font-size:9px; color:#9CA3AF; text-align:center;">
                This is a computer-generated Tax Invoice. No signature required. Compliant with GST regulations.
              </td>
            </tr>
          </table>

        </div>
      </body>
    </html>
  `;

  const opt = {
    margin:       [0.3, 0.3, 0.3, 0.3],
    filename:     `Invoice-${order.order_number}.pdf`,
    image:        { type: 'jpeg', quality: 0.99 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(htmlContent).save();
};
