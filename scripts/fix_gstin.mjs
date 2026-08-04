// Migration script to add GST column to addresses table and backfill GST from users
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
  console.log('Step 1: Adding gst column to addresses table...')

  // Add gst column to addresses table if it doesn't exist
  try {
    const { error: alterErr } = await supabase.rpc('add_column_if_not_exists', {
      table_name: 'addresses',
      column_name: 'gst',
      column_type: 'text'
    }).catch(() => null)

    // If RPC fails, try direct alter (will error if column exists - that's ok)
    if (alterErr) {
      console.log('  Note: Using alternative column addition method')
    }
  } catch (e) {
    console.log('  Column may already exist or migration needed')
  }

  // Check current columns
  const { data: sampleAddr } = await supabase.from('addresses').select('*').limit(1)
  if (sampleAddr && !sampleAddr[0].hasOwnProperty('gst')) {
    console.log('  ⚠️  Addresses table needs ALTER TABLE to add gst column')
    console.log('  Run this SQL in Supabase SQL Editor:')
    console.log('  ALTER TABLE addresses ADD COLUMN gst text;')
  } else {
    console.log('  ✅ gst column exists or table already has it')
  }

  console.log('\nStep 2: Backfilling GST from users to addresses...')

  // Get all users with GSTIN
  const { data: usersWithGst } = await supabase
    .from('users')
    .select('id, gst_number')
    .not('gst_number', 'is', null)

  console.log(`  Found ${usersWithGst?.length || 0} users with GSTIN`)

  if (usersWithGst && usersWithGst.length > 0) {
    // Get addresses for these users
    for (const user of usersWithGst) {
      const { data: addresses } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', user.id)

      if (addresses && addresses.length > 0) {
        // Update first address with GSTIN
        await supabase
          .from('addresses')
          .update({ gst: user.gst_number })
          .eq('id', addresses[0].id)
        console.log(`  ✅ Updated address for user ${user.id.slice(0,8)} with GST: ${user.gst_number}`)
      }
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)