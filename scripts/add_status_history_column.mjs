import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

try {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  })
} catch (e) {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function checkAndFixSchema() {
  console.log('=== CHECKING ORDERS TABLE SCHEMA ===\n')

  // Test updating status WITHOUT status_history first
  const targetOrderId = '8bc334ef-6920-46ac-aa86-2359a7a43abc'
  const { data: testOnlyStatus, error: sErr } = await supabase
    .from('orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', targetOrderId)
    .select()

  console.log('Update status ONLY result:', {
    error: sErr,
    updated_status: testOnlyStatus?.[0]?.status
  })
}

checkAndFixSchema()
