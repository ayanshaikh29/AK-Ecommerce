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

async function findUnsplash() {
  const tables = ['products', 'categories', 'banners', 'clients', 'settings', 'reviews']
  for (const t of tables) {
    const { data } = await supabase.from(t).select('*')
    if (data) {
      const str = JSON.stringify(data)
      if (str.includes('unsplash') || str.includes('1568871391150')) {
        console.log(`FOUND unsplash in table: ${t}`)
        for (const row of data) {
          const rowStr = JSON.stringify(row)
          if (rowStr.includes('unsplash') || rowStr.includes('1568871391150')) {
            console.log(`  Row ID ${row.id}:`, row)
          }
        }
      }
    }
  }
}

findUnsplash()
