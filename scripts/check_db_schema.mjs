import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envRaw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  const ORDER_ID = 'a14d15d5-b1ef-426f-bbca-54c7153a5829'

  const { data: o } = await supabase
    .from('orders')
    .select('*, addresses(*), order_items(*, products(*))')
    .eq('id', ORDER_ID)
    .maybeSingle()

  const { data: customer } = await supabase
    .from('users')
    .select('company_name, gst_number, business_name, full_name')
    .eq('id', o.user_id)
    .maybeSingle()
  o.customer_profile = customer || {}

  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()

  const { generateInvoicePDF } = await import('../lib/invoice-generator.js')
  const pdfBuffer = await generateInvoicePDF(o, settings || {})

  const outPath = path.join(__dirname, 'test_invoice_output.pdf')
  fs.writeFileSync(outPath, Buffer.from(pdfBuffer))
  console.log("✅ Invoice PDF generated:", outPath)
  console.log("GSTIN that should appear:", o.customer_profile.gst_number)
}

main().catch(console.error)
