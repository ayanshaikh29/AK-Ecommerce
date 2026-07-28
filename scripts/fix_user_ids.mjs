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

async function fixUserIds() {
  console.log('=== STARTING USER ID SYNC & FIX ===')

  // 1. Fetch auth users
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) {
    console.error('Error fetching auth users:', authErr)
    return
  }
  const authUsers = authData.users || []
  console.log(`Found ${authUsers.length} auth users.`)

  // 2. Fetch public users
  const { data: publicUsers, error: pubErr } = await supabase.from('users').select('*')
  if (pubErr) {
    console.error('Error fetching public users:', pubErr)
    return
  }
  console.log(`Found ${publicUsers.length} public users.`)

  for (const pUser of publicUsers) {
    const matchingAuth = authUsers.find(a => a.email.toLowerCase() === pUser.email.toLowerCase())
    if (matchingAuth) {
      if (matchingAuth.id !== pUser.id) {
        const oldId = pUser.id
        const newId = matchingAuth.id
        console.log(`Fixing mismatch for ${pUser.email}: ${oldId} -> ${newId}`)

        // Create new user row with new ID first to avoid FK violations
        const newUserRow = { ...pUser, id: newId }
        const { error: insertUserErr } = await supabase.from('users').insert(newUserRow)
        if (insertUserErr && !insertUserErr.message.includes('duplicate key')) {
          console.error(`Failed to insert updated user row:`, insertUserErr)
          continue
        }

        // Update child tables
        const updates = [
          { table: 'profiles', col: 'id' },
          { table: 'orders', col: 'user_id' },
          { table: 'addresses', col: 'user_id' },
          { table: 'customer_product_pricing', col: 'customer_id' },
          { table: 'customer_logins', col: 'user_id' },
          { table: 'catalog_requests', col: 'user_id' },
          { table: 'wishlist', col: 'user_id' },
          { table: 'reviews', col: 'user_id' },
          { table: 'vendors', col: 'user_id' },
          { table: 'stock_movements', col: 'created_by' }
        ]

        for (const { table, col } of updates) {
          try {
            const { error: uErr } = await supabase.from(table).update({ [col]: newId }).eq(col, oldId)
            if (uErr) console.warn(`Notice updating ${table}.${col}:`, uErr.message)
            else console.log(`  Updated ${table}.${col} to ${newId}`)
          } catch (e) {}
        }

        // Delete old user row
        const { error: delErr } = await supabase.from('users').delete().eq('id', oldId)
        if (delErr) console.error(`Error deleting old user row ${oldId}:`, delErr.message)
        else console.log(`  Deleted old user row ${oldId}`)
        
        // Ensure profiles row exists for newId
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', newId).maybeSingle()
        if (!prof) {
          await supabase.from('profiles').insert({
            id: newId,
            full_name: pUser.full_name || '',
            phone: pUser.phone || '',
            role: pUser.role || 'customer',
            created_at: pUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      } else {
        console.log(`User ${pUser.email} already matched ID: ${pUser.id}`)
      }
    } else {
      console.log(`Creating auth user for public user ${pUser.email} with id ${pUser.id}`)
      const { data: newAuth, error: createAuthErr } = await supabase.auth.admin.createUser({
        id: pUser.id,
        email: pUser.email,
        password: 'Password@123',
        email_confirm: true
      })
      if (createAuthErr) {
        console.error(`Failed to create auth user for ${pUser.email}:`, createAuthErr.message)
      } else {
        console.log(`Successfully created auth user for ${pUser.email}`)
      }
    }
  }

  // Check auth users without public users
  for (const aUser of authUsers) {
    const matchingPub = publicUsers.find(p => p.email.toLowerCase() === aUser.email.toLowerCase())
    if (!matchingPub) {
      console.log(`Creating public user row for auth user ${aUser.email} (${aUser.id})`)
      await supabase.from('users').insert({
        id: aUser.id,
        email: aUser.email,
        password: 'Password@123',
        full_name: aUser.email.split('@')[0],
        phone: '',
        role: 'customer',
        created_at: new Date().toISOString()
      })
      await supabase.from('profiles').insert({
        id: aUser.id,
        full_name: aUser.email.split('@')[0],
        phone: '',
        role: 'customer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  }

  console.log('=== FINISHED USER ID SYNC & FIX ===')
}

fixUserIds()
