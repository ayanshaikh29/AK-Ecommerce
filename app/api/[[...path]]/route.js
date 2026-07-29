import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { 
  getMinOrderQuantity, 
  setMinOrderQuantity, 
  getCustomerPricings, 
  getCustomerVisiblePricingMap, 
  saveCustomerPricing, 
  bulkUpdateCustomerPricing, 
  getStockMovements, 
  addStockMovement, 
  getVendorsList, 
  saveVendor, 
  getVendorByUserId 
} from '@/lib/b2b-store'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SECRET = process.env.AUTH_SECRET || 'dev-secret'
const SEED_VERSION = 'ak-v3-premium'

let _supabase = null
let _seeded = false
function db() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Missing Supabase credentials in .env")
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    })
  }
  return _supabase
}

function hashPw(pw) { return crypto.createHmac('sha256', SECRET).update(pw).digest('hex') }
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}
function verify(token) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  if (expected !== sig) return null
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()) } catch { return null }
}
async function getUser(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const parsed = verify(token)
  if (!parsed) return null
  
  if (parsed.email) {
    const supabase = db()
    const { data: dbUser, error: dbErr } = await supabase
      .from('users')
      .select('id, email, role, full_name, phone')
      .eq('email', parsed.email)
      .maybeSingle()
      
    if (dbErr) {
      console.error(`[getUser] DB lookup error for ${parsed.email}:`, dbErr.message)
    }

    if (dbUser) {
      // DB user is the source of truth
      parsed.id = dbUser.id
      parsed.role = dbUser.role
      parsed.full_name = dbUser.full_name
      parsed.phone = dbUser.phone || ''
    } else {
      console.warn(`[getUser] No DB row found for email=${parsed.email}. Using token id=${parsed.id}`)
    }
  }
  return parsed
}
function json(data, status = 200, cacheTTL = null) {
  const headers = {}
  if (cacheTTL) {
    headers['Cache-Control'] = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL * 2}, stale-while-revalidate=${cacheTTL}`
  }
  return NextResponse.json(data, { status, headers })
}
function err(msg, status = 400) { return NextResponse.json({ error: msg }, { status }) }

function buildStatusHistory(o) {
  let statusStr = o.status || 'pending'
  let statusHistory = []
  
  try {
    const parsed = JSON.parse(o.status)
    if (parsed && typeof parsed === 'object' && parsed.current) {
      return {
        status: parsed.current,
        history: parsed.history || []
      }
    }
  } catch (e) {}

  const pAt = o.placed_at || o.created_at
  const uAt = o.updated_at || pAt
  
  const steps = ['pending', 'confirmed', 'vendor_assigned', 'vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered']
  const currentKey = statusStr.toLowerCase().trim().replace(/ /g, '_')
  const activeIdx = steps.indexOf(currentKey)
  
  if (currentKey === 'rejected' || currentKey === 'vendor_rejected') {
    const reasonNote = o.rejection_reason ? `Reason: ${o.rejection_reason}` : 'Order was rejected'
    statusHistory = [
      { status: 'pending', timestamp: pAt, note: 'Order placed — Pending Admin Approval' },
      { status: currentKey, timestamp: uAt, note: `Order Rejected. ${reasonNote}` }
    ]
  } else if (activeIdx === -1) {
    statusHistory = [{ status: statusStr, timestamp: uAt, note: `Order status is ${statusStr}` }]
    if (currentKey === 'cancelled' || currentKey === 'returned') {
      statusHistory = [
        { status: 'pending', timestamp: pAt, note: 'Order placed — Pending Admin Approval' },
        { status: statusStr, timestamp: uAt, note: `Order was ${statusStr}` }
      ]
    }
  } else {
    statusHistory = []
    for (let i = 0; i <= activeIdx; i++) {
      const stepKey = steps[i]
      let ts = pAt
      let note = 'Order submitted — Pending Admin Approval'
      
      if (i === activeIdx) {
        ts = uAt
      } else if (i > 0) {
        const pTime = new Date(pAt).getTime()
        const uTime = new Date(uAt).getTime()
        ts = new Date(pTime + (uTime - pTime) * (i / activeIdx)).toISOString()
      }
      
      if (stepKey === 'pending') note = 'Order submitted — Pending Admin Approval'
      if (stepKey === 'confirmed') note = 'Order accepted by Admin'
      if (stepKey === 'vendor_assigned') note = 'Vendor logistics partner assigned'
      if (stepKey === 'vendor_accepted') note = 'Vendor accepted the assignment'
      if (stepKey === 'packed') note = 'Order packed at warehouse'
      if (stepKey === 'shipped') note = 'Package dispatched to courier partner'
      if (stepKey === 'out_for_delivery') note = 'Courier partner is delivering today'
      if (stepKey === 'delivered') note = 'Delivered to recipient location'
      
      statusHistory.push({ status: stepKey, timestamp: ts, note })
    }
  }
  
  return {
    status: statusStr,
    history: statusHistory
  }
}

async function ensureSeed() {
  if (_seeded) return
  const supabase = db()
  const { data: meta } = await supabase.from('meta').select('*').eq('id', 'seed').maybeSingle()
  if (meta && meta.version === SEED_VERSION) { _seeded = true; return }
  const now = new Date().toISOString()

  // Only create admin if missing — never delete existing users
  const { data: existingAdmin } = await supabase.from('users').select('*').eq('email', 'admin@store.com').maybeSingle()
  if (!existingAdmin) {
    let adminUuid = null
    try {
      const { data: authData } = await supabase.auth.admin.listUsers()
      const adminAuth = authData?.users?.find(a => a.email.toLowerCase() === 'admin@store.com')
      if (adminAuth) {
        adminUuid = adminAuth.id
      } else {
        const { data: newAuth, error: aErr } = await supabase.auth.admin.createUser({
          email: 'admin@store.com',
          password: 'Admin@123',
          email_confirm: true
        })
        if (!aErr && newAuth?.user) adminUuid = newAuth.user.id
      }
    } catch (e) {}

    await supabase.from('users').insert({
      id: adminUuid || uuidv4(), email: 'admin@store.com', password: hashPw('Admin@123'),
      full_name: 'AK Admin', phone: '+91 83088 60894', role: 'admin', created_at: now,
    })
  }

  // Only seed categories if none exist — never delete existing ones
  const { data: existingCats } = await supabase.from('categories').select('id').limit(1)
  if (!existingCats || existingCats.length === 0) {
    const cats = [
      { name: 'Office Stationery', slug: 'office-stationery', description: 'Papers, files, pens, notebooks & printer supplies', image_url: '/category-stationery.jpg', icon: 'FileText' },
      { name: 'Housekeeping', slug: 'housekeeping', description: 'Cleaning chemicals, tissues, mops & sanitation supplies', image_url: '/category-housekeeping.jpg', icon: 'Sparkles' },
      { name: 'UPS Solutions', slug: 'ups-solutions', description: 'UPS systems, batteries & power backup accessories', image_url: '/category-ups.jpg', icon: 'BatteryCharging' },
    ].map(c => ({ id: uuidv4(), ...c, created_at: now }))
    await supabase.from('categories').insert(cats)
  }

  // Only seed products if none exist — never delete existing ones
  const { data: existingProds } = await supabase.from('products').select('id').limit(1)
  if (!existingProds || existingProds.length === 0) {
    const catData = await supabase.from('categories').select('id, slug')
    const catBy = {}
    for (const c of (catData.data || [])) catBy[c.slug] = c.id
    const fallbackCat = catData.data?.[0]?.id

    const defaultProducts = [
      { name: 'A4 Copier Paper 75 GSM (500 Sheets)', cat: 'office-stationery', price: 285, mrp: 380, img: ['/category-stationery.jpg'], desc: 'Premium A4 printer & copier paper.', stock: 240, featured: true, subcategory: 'Printing & Copier Paper' },
      { name: 'Lizol Disinfectant Floor Cleaner 5L', cat: 'housekeeping', price: 545, mrp: 720, img: ['/category-housekeeping.jpg'], desc: 'Kills 99.9% germs. 5L economy pack.', stock: 55, featured: true, subcategory: 'Floor Cleaners' },
      { name: 'APC Home UPS BX600C-IN 600VA', cat: 'ups-solutions', price: 3850, mrp: 4900, img: ['/category-ups.jpg'], desc: 'APC Back-UPS BX600C-IN 600VA.', stock: 22, featured: true, subcategory: 'UPS Supply' },
    ]
    const productDocs = defaultProducts.map(p => ({
      id: uuidv4(), name: p.name, slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,''),
      description: p.desc, price: p.price, mrp: p.mrp,
      discount_percent: Math.round((1 - p.price/p.mrp) * 100),
      category_id: catBy[p.cat] || fallbackCat, subcategory: p.subcategory,
      stock_quantity: p.stock, sku: 'AK-' + Math.floor(Math.random()*90000+10000),
      is_active: true, is_featured: p.featured,
      rating_avg: 4.5, rating_count: 20,
      images: p.img, videos: [], created_at: now, updated_at: now,
    }))
    await supabase.from('products').insert(productDocs)
  }

  // Only seed banners if none exist
  const { data: existingBanners } = await supabase.from('banners').select('id').limit(1)
  if (!existingBanners || existingBanners.length === 0) {
    const banners = [
      { id: uuidv4(), title: 'Your Trusted B2B Partner', subtitle: 'Office Stationery • Housekeeping • UPS Solutions — all under one roof.', image_url: '/category-stationery.jpg', cta_text: 'Browse Catalog', cta_link: '/products', sort_order: 1, is_active: true, created_at: now },
    ]
    await supabase.from('banners').insert(banners)
  }

  // Only seed clients if none exist
  const { data: existingClients } = await supabase.from('clients').select('id').limit(1)
  if (!existingClients || existingClients.length === 0) {
    const clients = [{ id: uuidv4(), name: 'ICICI Lombard GIC', logo_url: '', sort_order: 1, is_active: true }]
    await supabase.from('clients').insert(clients)
  }

  // Settings — always upsert (idempotent)
  await supabase.from('settings').upsert({
    id: 'main', brand_name: 'AK Enterprises', brand_tagline: 'Trusted B2B Partner',
    hero_badge: 'Est. 2020 — Pune', promo_headline: 'Bulk orders? Get custom quotes in 2 hours',
    promo_subline: 'Corporate purchase for 100+ units? WhatsApp us or use our contact form.',
    promo_code: 'AK100', whatsapp_number: '918308860894', contact_phone: '+91 83088 60894',
    contact_email: 'akenterprises1411@gmail.com', contact_address: 'Pune - 411004',
    contact_person: 'Mr. Sagar Lahole', year_established: '2020',
    marquee_messages: ['🚚 Free Pan-India Delivery on Bulk Orders'], updated_at: now,
  })
  await supabase.from('meta').upsert({ id: 'seed', version: SEED_VERSION, done_at: now })
  _seeded = true
}

async function route(req, method) {
  const url = new URL(req.url)
  const rawParts = url.pathname.split('/').filter(Boolean)
  const parts = rawParts[0] === 'api' ? rawParts.slice(1) : rawParts
  const supabase = db()
  if (!SUPABASE_URL || !SUPABASE_KEY) return err('Database not configured', 500)
  await ensureSeed()
  
  const p = parts
  const user = await getUser(req)

  if (p[0] === 'realtime-config' && method === 'GET') {
    return json({ 
      supabaseUrl: SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || SUPABASE_KEY 
    })
  }

  if (p[0] === 'upload' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    try {
      const form = await req.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') return err('No file')
      const buf = Buffer.from(await file.arrayBuffer())
      const name = file.name || 'upload'
      const ext = (name.split('.').pop() || 'bin').toLowerCase()
      const filename = `${uuidv4()}.${ext}`

      const { data: bucket, error: bucketErr } = await supabase.storage.createBucket('product-images', { public: true })
      if (bucketErr && !bucketErr.message?.includes('already exists')) {
        console.error('Bucket creation error:', bucketErr)
      }

      const { error: uploadErr } = await supabase.storage.from('product-images').upload(filename, buf, {
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        cacheControl: '31536000'
      })
      if (uploadErr) return err('Storage upload failed: ' + uploadErr.message, 500)

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filename)
      return json({ url: publicUrl, filename, type: 'image', size: buf.length })
    } catch (e) {
      return err('Upload failed: ' + e.message, 500)
    }
  }

  const body = ['POST','PUT','PATCH'].includes(method) ? await req.json().catch(()=>({})) : {}

  if (p[0] === 'auth') {
    if (p[1] === 'signup' && method === 'POST') {
      const { email, password, full_name, phone, referred_by_code } = body
      if (!email || !password) return err('Email & password required')
      
      const { data: exists } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
      if (exists) return err('Email already registered', 409)
      
      // 1. Create user in auth.users first to get a unified UUID
      const { data: newAuthUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })
      if (authErr) {
        console.error('Auth signup failed:', authErr)
        return err('Authentication signup failed: ' + authErr.message, 500)
      }
      
      const newUuid = newAuthUser.user.id
      const nowStr = new Date().toISOString()
      const refCode = 'AKREF' + Math.random().toString(36).substring(2, 8).toUpperCase()
      
      let referredById = null
      if (referred_by_code) {
        const { data: referrer } = await supabase.from('users').select('id').eq('referral_code', referred_by_code.toUpperCase().trim()).maybeSingle()
        if (referrer) {
          referredById = referrer.id
        }
      }

      const u = { 
        id: newUuid, 
        email, 
        password: hashPw(password), 
        full_name: full_name||'', 
        phone: phone||'', 
        role: 'customer', 
        created_at: nowStr
      }
      
      // 2. Insert into custom public.users table (try with referral columns first, fallback without)
      let uErr = null
      const uWithReferral = { ...u, referral_code: refCode, referred_by_id: referredById }
      const res1 = await supabase.from('users').insert(uWithReferral)
      if (res1.error) {
        // Referral columns might not exist — retry without them
        if (res1.error.message?.includes('referral_code') || res1.error.message?.includes('referred_by_id')) {
          console.warn('Referral columns not found in users table, inserting without them')
          const res2 = await supabase.from('users').insert(u)
          uErr = res2.error
        } else {
          uErr = res1.error
        }
      }
      if (uErr) {
        // Rollback auth user creation if public.users insert fails
        await supabase.auth.admin.deleteUser(newUuid)
        return err('Signup failed: ' + uErr.message, 500)
      }
      

      
      // 3. Insert into public.profiles table to satisfy foreign key constraints
      const { error: pErr } = await supabase.from('profiles').insert({
        id: newUuid,
        full_name: u.full_name,
        phone: u.phone,
        role: u.role,
        created_at: u.created_at,
        updated_at: u.created_at
      })
      if (pErr) console.error('Profile creation failed:', pErr.message)

      const token = sign({ id: newUuid, email: u.email, role: u.role, name: u.full_name })
      return json({ token, user: { id: newUuid, email: u.email, full_name: u.full_name, role: u.role } })
    }
    if (p[1] === 'login' && method === 'POST') {
      const { email, password } = body
      const { data: u } = await supabase.from('users').select('*').eq('email', email).eq('password', hashPw(password)).maybeSingle()
      if (!u) return err('Invalid credentials', 401)

      // Self-heal: ensure profiles row exists (only for roles allowed by profiles_role_check)
      const PROFILE_ALLOWED_ROLES = ['customer', 'admin']
      if (PROFILE_ALLOWED_ROLES.includes(u.role)) {
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', u.id).maybeSingle()
        if (!prof) {
          const { error: pErr } = await supabase.from('profiles').insert({
            id: u.id,
            full_name: u.full_name,
            phone: u.phone || '',
            role: u.role,
            created_at: u.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          if (pErr) console.error('Self-heal profile creation failed:', pErr.message)
        }
      }

      // Record Customer Login Activity for Admin Realtime Notifications
      if (u.role === 'customer') {
        const loginRecord = {
          id: uuidv4(),
          user_id: u.id,
          user_name: u.full_name || u.email,
          email: u.email,
          phone: u.phone || '',
          login_at: new Date().toISOString()
        }

        let loginStored = false
        try {
          const { error: insErr } = await supabase.from('customer_logins').insert(loginRecord)
          if (!insErr) loginStored = true
        } catch (lErr) {}

        if (!loginStored) {
          try {
            const { data: store } = await supabase.from('settings')
              .select('marquee_messages')
              .eq('id', 'customer_logins_data')
              .maybeSingle()
            let loginsList = []
            if (store?.marquee_messages) {
              loginsList = store.marquee_messages.map(s => {
                try { return typeof s === 'string' ? JSON.parse(s) : s } catch { return null }
              }).filter(Boolean)
            }
            loginsList.unshift(loginRecord)
            loginsList = loginsList.slice(0, 50)
            await supabase.from('settings').upsert({
              id: 'customer_logins_data',
              marquee_messages: loginsList.map(r => JSON.stringify(r))
            })
          } catch (e) {
            console.error('Failed to record login activity:', e)
          }
        }
      }

      const token = sign({ id: u.id, email: u.email, role: u.role, name: u.full_name })
      return json({ token, user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, phone: u.phone } })
    }

    if (p[1] === 'me' && method === 'GET') {
      if (!user) return err('Unauthorized', 401)
      const { data: u } = await supabase.from('users').select('id, email, full_name, phone, role').eq('id', user.id).maybeSingle()
      return json({ user: u })
    }
    if (p[1] === 'forgot-password' && method === 'POST') {
      const { email } = body
      if (!email) return err('Email address is required', 400)

      const genericMsg = 'If an account exists with this email, a password reset link has been sent.'

      try {
        const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const redirectTo = `${origin}/reset-password`

        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo
        })
        if (resetErr) {
          console.error('Supabase resetPasswordForEmail error:', resetErr.message)
        }
      } catch (e) {
        console.error('Forgot password exception:', e.message)
      }

      return json({ ok: true, message: genericMsg })
    }

    if (p[1] === 'reset-password' && method === 'POST') {
      const { password, email, user_id } = body
      if (!password || password.length < 8) {
        return err('Password must be at least 8 characters long', 400)
      }

      const now = new Date().toISOString()
      const hashed = hashPw(password)

      let targetUserId = user_id || user?.id

      if (!targetUserId && email) {
        const { data: u } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).maybeSingle()
        if (u) targetUserId = u.id
      }

      if (targetUserId) {
        try {
          await supabase.auth.admin.updateUserById(targetUserId, { password })
        } catch (aErr) {
          console.error('Auth updateUserById error:', aErr.message)
        }

        const { error: uErr } = await supabase
          .from('users')
          .update({ password: hashed, updated_at: now })
          .eq('id', targetUserId)

        if (uErr) return err('Failed to update password: ' + uErr.message, 500)
        return json({ ok: true, message: 'Password updated successfully. You can now log in.' })
      } else {
        return err('Invalid or expired password reset request.', 400)
      }
    }
  }

  if (p[0] === 'customer-access' && method === 'GET') {
    if (!user) return json({ has_access: false, logged_in: false, message: "Log in required" })
    if (user.role === 'admin') return json({ has_access: true, is_admin: true })
    if (user.role === 'vendor') return json({ has_access: false, is_vendor: true, message: "Vendor accounts do not have catalog access." })
    
    const visibleMap = await getCustomerVisiblePricingMap(user.id)
    return json({ has_access: visibleMap.size > 0, visible_count: visibleMap.size })
  }

  if (p[0] === 'categories' && method === 'GET') {
    const { data: cats } = await supabase.from('categories').select('*')
    return json(cats || [], 200, 300)
  }

  if (p[0] === 'products') {
    if (method === 'GET' && !p[1]) {
      if (!user) {
        return json({ catalog_locked: true, products: [], message: "Catalog browsing is restricted. Please log in to view products and prices." }, 401)
      }
      if (user.role === 'vendor') {
        return json({ catalog_locked: true, products: [], message: "Vendor accounts do not have catalog access." }, 403)
      }

      let customerPricingMap = null
      if (user.role === 'customer') {
        console.log(`[/api/products] Fetching catalog for customer: id=${user.id} email=${user.email}`)
        customerPricingMap = await getCustomerVisiblePricingMap(user.id)
        console.log(`[/api/products] Pricing map size for customer ${user.id}: ${customerPricingMap.size} visible products`)
        if (customerPricingMap.size > 0) {
          console.log(`[/api/products] Visible product IDs for ${user.id}:`, Array.from(customerPricingMap.keys()).slice(0, 5))
        }
        if (customerPricingMap.size === 0) {
          return json({ catalog_locked: true, products: [], message: "Contact us to get catalog access." })
        }
      }

      let query = supabase.from('products').select('*, product_images(image_url)').eq('is_active', true)
      
      const category = url.searchParams.get('category')
      const search = url.searchParams.get('search')
      const featured = url.searchParams.get('featured')
      const minPrice = url.searchParams.get('minPrice')
      const maxPrice = url.searchParams.get('maxPrice')
      const brand = url.searchParams.get('brand')
      const rating = url.searchParams.get('rating')
      const sort = url.searchParams.get('sort') || 'newest'
      
      if (customerPricingMap) {
        const assignedIds = Array.from(customerPricingMap.keys())
        if (assignedIds.length === 0) return json({ catalog_locked: true, products: [] })
        query = query.in('id', assignedIds)
      }

      if (category) {
        const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).maybeSingle()
        if (cat) query = query.eq('category_id', cat.id)
      }
      if (search) query = query.ilike('name', `%${search}%`)
      if (featured) query = query.eq('is_featured', true)
      if (minPrice) query = query.gte('price', +minPrice)
      if (maxPrice) query = query.lte('price', +maxPrice)
      if (brand) query = query.eq('brand', brand)
      if (rating) query = query.gte('rating_avg', +rating)
      
      if (sort === 'price-asc') query = query.order('price', { ascending: true })
      else if (sort === 'price-desc') query = query.order('price', { ascending: false })
      else if (sort === 'popular') query = query.order('rating_count', { ascending: false })
      else query = query.order('created_at', { ascending: false })
      
      const { data: list } = await query
      const listMapped = (list || []).map(p => {
        const customPrice = customerPricingMap ? customerPricingMap.get(p.id) : p.price
        const rawImgs = (p.product_images || []).map(img => img.image_url).filter(Boolean)
        let finalImgs = []
        if (rawImgs.length > 0) finalImgs = rawImgs
        else if (p.images && p.images.length > 0) finalImgs = p.images.filter(Boolean)
        else if (p.image_url) finalImgs = [p.image_url]
        else finalImgs = ['/placeholder.png']

        return {
          ...p,
          price: customPrice !== undefined ? customPrice : p.price,
          original_default_price: user.role === 'admin' ? p.price : undefined,
          images: finalImgs,
          image_url: finalImgs[0]
        }
      })
      return json({ catalog_locked: false, products: listMapped }, 200)
    }
    if (method === 'GET' && p[1]) {
      if (!user) return err('Unauthorized', 401)
      if (user.role === 'vendor') return err('Forbidden for vendors', 403)

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p[1])
      const query = isUUID
        ? supabase.from('products').select('*, product_images(image_url)').eq('id', p[1])
        : supabase.from('products').select('*, product_images(image_url)').eq('slug', p[1])
      const { data: prod } = await query.maybeSingle()
      if (!prod) return err('Not found', 404)

      if (user.role === 'customer') {
        const visibleMap = await getCustomerVisiblePricingMap(user.id)
        if (!visibleMap.has(prod.id)) {
          return err('Product not assigned to your custom catalog', 403)
        }
        prod.price = visibleMap.get(prod.id)
      }

      const { data: cat } = await supabase.from('categories').select('*').eq('id', prod.category_id).maybeSingle()
      const { data: related } = await supabase.from('products').select('*, product_images(image_url)').eq('category_id', prod.category_id).neq('id', prod.id).limit(4)
      const { data: reviews } = await supabase.from('reviews').select('*').eq('product_id', prod.id).order('created_at', { ascending: false })
      
      let relatedMapped = (related || []).map(p => ({
        ...p,
        images: p.product_images?.map(img => img.image_url) || []
      }))

      if (user.role === 'customer') {
        const visibleMap = await getCustomerVisiblePricingMap(user.id)
        relatedMapped = relatedMapped
          .filter(r => visibleMap.has(r.id))
          .map(r => ({ ...r, price: visibleMap.get(r.id) }))
      }

      const prodMapped = {
        ...prod,
        images: prod.product_images?.map(img => img.image_url) || []
      }
      return json({ ...prodMapped, category: cat, related: relatedMapped, reviews: reviews || [] })
    }
    if (method === 'POST') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const now = new Date().toISOString()
      const pId = uuidv4()
      const doc = { 
        id: pId, 
        name: body.name, 
        slug: (body.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'), 
        description: body.description, 
        price: body.price, 
        mrp: body.mrp, 
        discount_percent: body.mrp?Math.round((1-body.price/body.mrp)*100):0, 
        category_id: body.category_id, 
        stock_quantity: body.stock_quantity, 
        sku: body.sku || 'AK-' + Math.floor(Math.random()*90000+10000), 
        is_active: body.is_active!==false, 
        created_at: now, 
        updated_at: now, 
        rating_avg: 0, 
        rating_count: 0 
      }
      await supabase.from('products').insert(doc)
      if (body.images?.length > 0) {
        const imgDocs = body.images.map((url, idx) => ({ id: uuidv4(), product_id: pId, image_url: url, sort_order: idx, created_at: now }))
        await supabase.from('product_images').insert(imgDocs)
      }
      return json({ ...doc, images: body.images || [] })
    }
    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const now = new Date().toISOString()
      const upd = { 
        name: body.name, 
        slug: body.slug, 
        description: body.description, 
        price: body.price, 
        mrp: body.mrp, 
        category_id: body.category_id, 
        stock_quantity: body.stock_quantity, 
        sku: body.sku, 
        is_active: body.is_active, 
        updated_at: now 
      }
      if (body.mrp && body.price) upd.discount_percent = Math.round((1-body.price/body.mrp)*100)
      await supabase.from('products').update(upd).eq('id', p[1])
      if (body.images) {
        await supabase.from('product_images').delete().eq('product_id', p[1])
        if (body.images.length > 0) {
          const imgDocs = body.images.map((url, idx) => ({ id: uuidv4(), product_id: p[1], image_url: url, sort_order: idx, created_at: now }))
          await supabase.from('product_images').insert(imgDocs)
        }
      }
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('product_images').delete().eq('product_id', p[1])
      await supabase.from('products').delete().eq('id', p[1])
      return json({ ok: true })
    }
  }

  if (p[0] === 'products-bulk' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const rows = body.rows || []
    const { data: cats } = await supabase.from('categories').select('*')
    const catMap = Object.fromEntries((cats||[]).map(c => [c.slug, c.id]))
    const now = new Date().toISOString()
    const productDocs = []
    const imageDocs = []
    for (const r of rows) {
      if (!r.name) continue
      const pId = uuidv4()
      productDocs.push({
        id: pId, 
        name: r.name, 
        slug: (r.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'),
        description: r.description||'', 
        price: +r.price||0, 
        mrp: +r.mrp||+r.price||0,
        discount_percent: r.mrp?Math.round((1-(+r.price)/(+r.mrp))*100):0,
        category_id: catMap[r.category_slug] || cats[0]?.id,
        subcategory: r.subcategory||'',
        stock_quantity: +r.stock_quantity||0, 
        sku: r.sku||'AK-'+Math.floor(Math.random()*90000+10000),
        is_active: true, 
        is_featured: r.is_featured === 'true' || r.is_featured === true,
        rating_avg: 0, 
        rating_count: 0, 
        created_at: now, 
        updated_at: now
      })
      const imgUrls = (r.images||'').split('|').filter(Boolean)
      imgUrls.forEach((url, idx) => {
        imageDocs.push({ id: uuidv4(), product_id: pId, image_url: url, sort_order: idx, created_at: now })
      })
    }
    if (productDocs.length) {
      await supabase.from('products').insert(productDocs)
      if (imageDocs.length) {
        await supabase.from('product_images').insert(imageDocs)
      }
    }
    return json({ inserted: productDocs.length })
  }

  if (p[0] === 'profile' && method === 'PUT') {
    if (!user) return err('Unauthorized', 401)
    const { full_name, phone, email } = body
    if (!email || !full_name) return err('Email and Name are required')
    
    const { data: emailExists } = await supabase.from('users').select('id').eq('email', email).neq('id', user.id).maybeSingle()
    if (emailExists) return err('Email is already in use by another account', 409)

    const { error: uErr } = await supabase.from('users').update({ full_name, phone, email }).eq('id', user.id)
    if (uErr) return err('Profile update failed (users): ' + uErr.message, 500)
    
    const { error: pErr } = await supabase.from('profiles').update({ full_name, phone }).eq('id', user.id)
    if (pErr) console.error('Profile update warning (profiles):', pErr.message)

    const token = sign({ id: user.id, email, role: user.role, name: full_name })
    return json({ token, user: { id: user.id, email, full_name, role: user.role, phone } })
  }

  if (p[0] === 'wishlist') {
    if (!user) return err('Unauthorized', 401)
    
    if (method === 'GET') {
      const { data: items, error: getErr } = await supabase
        .from('wishlist_items')
        .select('*, products(*, product_images(image_url))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (getErr) return err('Failed to fetch wishlist: ' + getErr.message, 500)
      
      const mapped = (items || []).map(item => ({
        id: item.id,
        product: item.products ? {
          ...item.products,
          image: item.products.product_images?.[0]?.image_url || '/placeholder.png'
        } : null,
        created_at: item.created_at
      })).filter(item => item.product !== null)
      
      return json(mapped)
    }
    
    if (method === 'POST') {
      const { product_id } = body
      if (!product_id) return err('Product ID is required')
      
      const { data: existing, error: existErr } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product_id)
        .maybeSingle()
        
      if (existErr) return err('Wishlist query error: ' + existErr.message, 500)
      
      if (existing) {
        const { error: delErr } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('id', existing.id)
        if (delErr) return err('Failed to remove from wishlist: ' + delErr.message, 500)
        return json({ status: 'removed', product_id })
      } else {
        const { error: insErr } = await supabase
          .from('wishlist_items')
          .insert({
            id: uuidv4(),
            user_id: user.id,
            product_id,
            created_at: new Date().toISOString()
          })
        if (insErr) return err('Failed to add to wishlist: ' + insErr.message, 500)
        return json({ status: 'added', product_id })
      }
    }
  }

  if (p[0] === 'addresses') {
    if (!user) return err('Unauthorized', 401)
    
    if (method === 'GET') {
      const { data: addrs, error: getErr } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      if (getErr) return err('Failed to fetch addresses: ' + getErr.message, 500)
      return json(addrs || [])
    }
    
    if (method === 'POST') {
      const { full_name, phone, line1, line2, city, state, pincode, is_default } = body
      if (!full_name || !phone || !line1 || !city || !state || !pincode) return err('Missing address fields')
      const addrId = uuidv4()
      const now = new Date().toISOString()
      
      if (is_default) {
        const { error: updErr } = await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
        if (updErr) return err('Failed to clear default address: ' + updErr.message, 500)
      }
      
      const newAddr = {
        id: addrId,
        user_id: user.id,
        full_name,
        phone,
        line1,
        line2: line2 || '',
        city,
        state,
        pincode,
        is_default: !!is_default,
        created_at: now,
        updated_at: now
      }
      
      const { error: insErr } = await supabase.from('addresses').insert(newAddr)
      if (insErr) return err('Failed to insert address: ' + insErr.message, 500)
      return json(newAddr)
    }
    
    if (method === 'PUT' && p[1]) {
      const { full_name, phone, line1, line2, city, state, pincode, is_default } = body
      const now = new Date().toISOString()
      
      if (is_default) {
        const { error: updErr } = await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
        if (updErr) return err('Failed to clear default address: ' + updErr.message, 500)
      }
      
      const upd = {
        full_name,
        phone,
        line1,
        line2: line2 || '',
        city,
        state,
        pincode,
        is_default: !!is_default,
        updated_at: now
      }
      
      const { error: updErr } = await supabase.from('addresses').update(upd).eq('id', p[1]).eq('user_id', user.id)
      if (updErr) return err('Failed to update address: ' + updErr.message, 500)
      return json({ ok: true })
    }
    
    if (method === 'DELETE' && p[1]) {
      const { error: delErr } = await supabase.from('addresses').delete().eq('id', p[1]).eq('user_id', user.id)
      if (delErr) return err('Failed to delete address: ' + delErr.message, 500)
      return json({ ok: true })
    }
  }

  if (p[0] === 'orders') {
    if (method === 'GET' && !p[1]) {
      if (!user) return err('Unauthorized', 401)
      let query = supabase.from('orders').select('*, addresses(*), order_items(*, products(*, product_images(image_url)))')
      if (user.role !== 'admin') query = query.eq('user_id', user.id)
      const status = url.searchParams.get('status')
      const { data: orders, error: getErr } = await query.order('placed_at', { ascending: false })
      if (getErr) return err('Failed to fetch orders: ' + getErr.message, 500)
      
      const mapped = (orders || []).map(o => {
        const { status: statusStr, history: statusHistory } = buildStatusHistory(o)
        return {
          ...o,
          status: statusStr,
          status_history: statusHistory,
          address: o.addresses,
          items: (o.order_items || []).map(it => ({
            ...it,
            image: it.products?.product_images?.[0]?.image_url || '/placeholder.png'
          }))
        }
      })
      
      let filtered = mapped
      if (status) {
        filtered = mapped.filter(o => o.status.toLowerCase() === status.toLowerCase())
      }
      return json(filtered)
    }
    
    if (method === 'GET' && p[1]) {
      if (!user) return err('Unauthorized', 401)
      const { data: o, error: getErr } = await supabase
        .from('orders')
        .select('*, addresses(*), order_items(*, products(*, product_images(image_url)))')
        .eq('id', p[1])
        .maybeSingle()
      if (getErr) return err('Failed to fetch order details: ' + getErr.message, 500)
      if (!o) return err('Not found', 404)
      if (user.role !== 'admin' && o.user_id !== user.id) return err('Forbidden', 403)
      
      const { status: statusStr, history: statusHistory } = buildStatusHistory(o)
      
      const orderMapped = {
        ...o,
        status: statusStr,
        status_history: statusHistory,
        address: o.addresses,
        items: (o.order_items || []).map(it => ({
          ...it,
          image: it.products?.product_images?.[0]?.image_url || '/placeholder.png'
        }))
      }
      return json(orderMapped)
    }
    
    if (method === 'POST') {
      if (!user) return err('Unauthorized', 401)
      const { items, address, payment_method } = body
      if (!items?.length || !address) return err('Invalid order request', 400)
      
      // 1. Minimum Order Quantity (MOQ) Check
      const minOrderQty = await getMinOrderQuantity()
      const totalUnits = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)
      if (totalUnits < minOrderQty) {
        return err(`Minimum order quantity is ${minOrderQty} units. You currently have ${totalUnits} units — please add ${minOrderQty - totalUnits} more.`, 400)
      }

      // 2. Validate Customer Catalog Assignment & Custom Prices Server-Side
      const visibleMap = await getCustomerVisiblePricingMap(user.id)
      if (visibleMap.size === 0 && user.role !== 'admin') {
        return err('Your account does not have catalog pricing access yet. Please contact support.', 403)
      }

      const verifiedItems = []
      let computedSubtotal = 0

      for (const item of items) {
        const prodId = item.product_id || item.id
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('id, name, price, stock_quantity')
          .eq('id', prodId)
          .maybeSingle()

        if (prodErr || !prod) {
          return err(`Product not found: ${item.name || prodId}`, 400)
        }

        // Validate assignment for non-admin
        let itemPrice = prod.price
        if (user.role === 'customer') {
          if (!visibleMap.has(prod.id)) {
            return err(`Product "${prod.name}" is not included in your assigned custom catalog.`, 403)
          }
          itemPrice = visibleMap.get(prod.id)
        }

        const qty = Math.max(1, Number(item.quantity) || 1)
        computedSubtotal += itemPrice * qty

        verifiedItems.push({
          product_id: prod.id,
          product_name_snapshot: prod.name,
          price_snapshot: itemPrice,
          quantity: qty,
          _current_stock: prod.stock_quantity
        })
      }

      const shippingFee = computedSubtotal >= 2000 ? 0 : 150
      const computedTotal = computedSubtotal + shippingFee

      let addrId = address.id
      const now = new Date().toISOString()
      
      if (!addrId || typeof addrId !== 'string' || addrId.length < 10) {
        const { data: existing } = await supabase
          .from('addresses')
          .select('id')
          .eq('user_id', user.id)
          .eq('line1', address.line1)
          .eq('pincode', address.pincode)
          .maybeSingle()
          
        if (existing) {
          addrId = existing.id
        } else {
          addrId = uuidv4()
          const { error: addrErr } = await supabase.from('addresses').insert({
            id: addrId,
            user_id: user.id,
            full_name: address.full_name,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2 || '',
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            is_default: false,
            created_at: now,
            updated_at: now
          })
          if (addrErr) return err('Failed to save shipping address: ' + addrErr.message, 500)
        }
      }
      
      const orderId = uuidv4()
      const order_number = 'AK' + Date.now().toString().slice(-8)
      
      const orderDoc = {
        id: orderId,
        user_id: user.id,
        order_number,
        status: 'pending', // Starts as Pending Admin Approval
        payment_method: payment_method || 'COD',
        subtotal: computedSubtotal,
        discount: body.discount || 0,
        shipping_fee: shippingFee,
        total: computedTotal,
        address_id: addrId,
        payment_status: 'Pending',
        placed_at: now,
        created_at: now,
        updated_at: now
      }
      
      const { error: orderErr } = await supabase.from('orders').insert(orderDoc)
      if (orderErr) {
        console.error('Database Order insert error:', orderErr)
        return err('Order database creation failed: ' + orderErr.message, 500)
      }
      
      const itemDocs = verifiedItems.map(item => ({
        id: uuidv4(),
        order_id: orderId,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        price_snapshot: item.price_snapshot,
        quantity: item.quantity,
        created_at: now
      }))
      
      const { error: itemsErr } = await supabase.from('order_items').insert(itemDocs)
      if (itemsErr) {
        console.error('Database Order items insert error:', itemsErr)
        await supabase.from('orders').delete().eq('id', orderId)
        return err('Order items database creation failed: ' + itemsErr.message, 500)
      }
      
      const trackingData = {
        current: 'pending',
        history: [{ status: 'pending', timestamp: now, note: 'Order submitted — Pending Admin Approval' }]
      }
      
      return json({
        ...orderDoc,
        status: 'pending',
        status_history: trackingData.history,
        address,
        items: itemDocs
      })
    }
    
    if (method === 'PUT' && p[1]) {
      if (!user) return err('Unauthorized', 401)
      const { data: orderToUpdate, error: fetchOrderErr } = await supabase
        .from('orders')
        .select('*, order_items(*, products(id, name, stock_quantity))')
        .eq('id', p[1])
        .maybeSingle()
        
      if (fetchOrderErr || !orderToUpdate) {
        console.error('[Order Fetch Error]:', fetchOrderErr || 'Order not found')
        return err('Order not found: ' + (fetchOrderErr?.message || 'ID does not exist'), 404)
      }
      
      const newStatus = body.status
      const now = new Date().toISOString()
      
      // Self-cancellation by customer while pending
      if (user.role !== 'admin' && user.id === orderToUpdate.user_id) {
        if (newStatus === 'cancelled' && ['pending', 'confirmed'].includes(orderToUpdate.status)) {
          await supabase.from('orders').update({ status: 'cancelled', updated_at: now }).eq('id', p[1])
          return json({ ok: true, status: 'cancelled' })
        }
        return err('Forbidden', 403)
      }

      if (user.role !== 'admin') return err('Forbidden', 403)

      const updatePayload = { updated_at: now }

      // Normalize status to match PostgreSQL CHECK constraint
      let targetStatus = newStatus
      if (targetStatus === 'approved') targetStatus = 'confirmed'
      if (targetStatus === 'out for delivery') targetStatus = 'out_for_delivery'
      if (targetStatus === 'accepted') targetStatus = 'vendor_accepted'

      // Handle Admin Accept Order (move from pending -> confirmed)
      if (targetStatus === 'confirmed' && orderToUpdate.status !== 'confirmed') {
        // Deduct stock & log stock movements (auto-adjusting stock if needed for B2B wholesale orders)
        for (const item of (orderToUpdate.order_items || [])) {
          const prod = item.products
          if (!prod) continue
          
          // Ensure stock_quantity covers requested quantity for wholesale fulfillment
          if ((prod.stock_quantity || 0) < item.quantity) {
            await supabase.from('products').update({ stock_quantity: item.quantity + 100 }).eq('id', item.product_id)
          }

          try {
            await addStockMovement({
              product_id: item.product_id,
              movement_type: 'outward',
              quantity: item.quantity,
              reference: `ORDER-${orderToUpdate.order_number}`,
              notes: `Outward fulfillment for Order #${orderToUpdate.order_number}`,
              created_by: user.id
            })
          } catch (mErr) {
            console.error('Stock movement warning:', mErr.message)
          }
        }
        updatePayload.status = 'confirmed'
      } else if (targetStatus === 'rejected') {
        updatePayload.status = 'rejected'
        updatePayload.rejection_reason = body.rejection_reason || 'Order rejected by Admin'
      } else if (targetStatus) {
        updatePayload.status = targetStatus
      }

      if (targetStatus && targetStatus !== orderToUpdate.status) {
        const history = Array.isArray(orderToUpdate.status_history) ? [...orderToUpdate.status_history] : []
        history.push({
          status: targetStatus,
          note: `Order status updated to ${targetStatus.toUpperCase()}`,
          timestamp: now
        })
        updatePayload.status_history = history
      }

      if (body.assigned_vendor_id !== undefined) {
        const vendorId = body.assigned_vendor_id
        updatePayload.assigned_vendor_id = vendorId

        // Look up vendor details to denormalize name/email into the order
        const { data: vendorRecord, error: vendorFetchErr } = await supabase
          .from('vendors')
          .select('id, name, email, user_id')
          .eq('id', vendorId)
          .maybeSingle()

        if (vendorFetchErr) {
          console.error('[Vendor Lookup Error]:', vendorFetchErr)
          return err('Failed to look up vendor: ' + vendorFetchErr.message, 500)
        }

        if (!vendorRecord) {
          return err('Vendor not found for ID: ' + vendorId + '. Check that the vendor exists in the vendors table.', 404)
        }

        updatePayload.vendor_name = vendorRecord.name || ''
        updatePayload.vendor_email = vendorRecord.email || ''
        updatePayload.assigned_at = now
        updatePayload.assigned_by = user.full_name || user.email || 'Admin'
      }

      if (body.internal_notes !== undefined) {
        updatePayload.internal_notes = body.internal_notes
      }

      if (body.payment_status !== undefined) {
        updatePayload.payment_status = body.payment_status
      }

      const { error: updErr } = await supabase.from('orders').update(updatePayload).eq('id', p[1])
      if (updErr) {
        const rawMsg = updErr.message || ''
        const rawCode = updErr.code || ''
        console.error('[Order Update DB Error]:', { code: rawCode, message: rawMsg, hint: updErr.hint, details: updErr.details })

        const isColumnErr = rawCode === '42703' || rawMsg.includes('does not exist') || rawMsg.includes('column')
        const isConstraintErr = rawCode === '23514' || rawMsg.includes('violates check constraint') || rawMsg.includes('violates foreign key constraint')
        const isHistoryErr = rawCode === 'PGRST204' || rawMsg.includes('status_history')

        if (isColumnErr || isHistoryErr) {
          const safePayload = { ...updatePayload }
          delete safePayload.status_history
          delete safePayload.vendor_name
          delete safePayload.vendor_email
          delete safePayload.assigned_at
          delete safePayload.assigned_by
          const { error: retryErr } = await supabase.from('orders').update(safePayload).eq('id', p[1])
          if (retryErr) {
            console.error('[Order Update Retry Fail]:', retryErr)
            return err('Database error after retry: ' + retryErr.message + ' (Code: ' + retryErr.code + ')', 500)
          }
        } else if (isConstraintErr) {
          return err('Constraint violation: ' + rawMsg + ' (Code: ' + rawCode + '). The status value "' + (targetStatus || 'none') + '" may not be allowed. Run the vendor assignment fix migration.', 500)
        } else {
          return err('Database error: ' + rawMsg + ' (Code: ' + rawCode + ')', 500)
        }
      }

      // Post-assignment: create notifications for vendor, customer, admin
      if (body.assigned_vendor_id !== undefined) {
        const vendorId = body.assigned_vendor_id
        const ordNum = orderToUpdate.order_number || p[1]
        try {
          const { data: vendorRecord } = await supabase.from('vendors').select('user_id, name, email').eq('id', vendorId).maybeSingle()
          const notifications = []
          const notifNow = new Date().toISOString()

          // Admin notification
          notifications.push({
            id: uuidv4(), user_id: user.id,
            title: 'Vendor Assigned Successfully',
            message: `Vendor "${vendorRecord?.name || 'Partner'}" assigned to Order #${ordNum}.`,
            type: 'vendor_assigned', is_read: false, created_at: notifNow
          })

          // Vendor notification
          if (vendorRecord?.user_id) {
            notifications.push({
              id: uuidv4(), user_id: vendorRecord.user_id,
              title: 'New Dispatch Assignment',
              message: `You have been assigned Order #${ordNum}. Open your Vendor Portal to accept.`,
              type: 'vendor_assigned', is_read: false, created_at: notifNow,
              link: '/vendor'
            })
          }

          // Customer notification
          if (orderToUpdate.user_id) {
            notifications.push({
              id: uuidv4(), user_id: orderToUpdate.user_id,
              title: 'Logistics Partner Assigned',
              message: `Your order #${ordNum} has been assigned to a logistics partner and will be dispatched soon.`,
              type: 'order_update', is_read: false, created_at: notifNow,
              link: '/orders/' + p[1]
            })
          }

          if (notifications.length > 0) {
            const { error: notifInsErr } = await supabase.from('notifications').insert(notifications)
            if (notifInsErr) {
              // Notifications table may not exist yet — log warning
              console.warn('[Notification Insert Error]:', notifInsErr.message, notifInsErr.code)
            }
          }

          // Also log to activity_logs for admin feed
          try {
            await supabase.from('activity_logs').insert({
              id: uuidv4(),
              user_id: user.id,
              user_name: user.full_name || 'Admin',
              user_email: user.email,
              event_type: 'order',
              title: 'Vendor Assigned',
              description: `Vendor "${vendorRecord?.name || 'Partner'}" assigned to Order #${ordNum}`,
              metadata: { order_id: p[1], vendor_id: vendorId, order_number: ordNum },
              created_at: notifNow
            })
          } catch (actErr) {
            console.warn('[Activity Log Insert Error]:', actErr.message)
          }
        } catch (notifErr) {
          console.warn('[Vendor Assignment Notification Fail]:', notifErr.message)
        }
      }

      return json({ ok: true, status: updatePayload.status || orderToUpdate.status })
    }
  }

  // ==================== COUPONS ====================


  // ==================== RETURN REQUESTS ====================
  if (p[0] === 'return-requests') {
    if (!user) return err('Unauthorized', 401)
    const supabase = db()

    if (method === 'GET') {
      let query = supabase.from('return_requests').select('*, orders(order_number, total, placed_at)').order('created_at', { ascending: false })
      if (user.role !== 'admin') query = query.eq('user_id', user.id)
      const { data, error } = await query
      if (error) return err('Failed to fetch return requests: ' + error.message, 500)
      return json(data || [])
    }

    if (method === 'POST') {
      const { order_id, reason, details } = body
      if (!order_id || !reason) return err('Order ID and reason are required')
      const { data: order } = await supabase.from('orders').select('id, user_id').eq('id', order_id).maybeSingle()
      if (!order || (user.role !== 'admin' && order.user_id !== user.id)) return err('Order not found', 404)
      const { error } = await supabase.from('return_requests').insert({
        id: uuidv4(),
        order_id,
        user_id: user.id,
        reason,
        details: details || '',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      if (error) return err('Failed to submit return request: ' + error.message, 500)
      await supabase.from('orders').update({ status: 'returned', updated_at: new Date().toISOString() }).eq('id', order_id)
      return json({ ok: true })
    }

    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { status } = body
      const { error } = await supabase.from('return_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', p[1])
      if (error) return err('Failed to update return request: ' + error.message, 500)
      return json({ ok: true })
    }
  }

  // ==================== BULK ENQUIRIES ====================
  if (p[0] === 'bulk-enquiries') {
    const supabase = db()

    if (method === 'GET') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { data, error } = await supabase.from('bulk_enquiries').select('*').order('created_at', { ascending: false })
      if (error) return err('Failed to fetch enquiries: ' + error.message, 500)
      return json(data || [])
    }

    if (method === 'POST') {
      const { company_name, contact_person, phone, email, products_needed, quantity, message } = body
      if (!contact_person || !phone || !products_needed) return err('Missing required fields')
      const { error } = await supabase.from('bulk_enquiries').insert({
        id: uuidv4(),
        company_name: company_name || '',
        contact_person,
        phone,
        email: email || '',
        products_needed,
        quantity: quantity || '',
        message: message || '',
        status: 'new',
        created_at: new Date().toISOString()
      })
      if (error) return err('Failed to submit enquiry: ' + error.message, 500)
      return json({ ok: true })
    }
  }

  if (p[0] === 'reviews' && method === 'POST') {
    if (!user) return err('Unauthorized', 401)
    const { product_id, rating, comment } = body
    if (!product_id || !rating) return err('Missing fields')
    const rev = { id: uuidv4(), product_id, user_id: user.id, user_name: user.name || user.email, rating: +rating, comment: comment||'', created_at: new Date().toISOString() }
    await supabase.from('reviews').insert(rev)
    
    const { data: all } = await supabase.from('reviews').select('rating').eq('product_id', product_id)
    if (all && all.length) {
      const avg = all.reduce((s,r)=>s+r.rating,0)/all.length
      await supabase.from('products').update({ rating_avg: +avg.toFixed(1), rating_count: all.length }).eq('id', product_id)
    }
    return json(rev)
  }

  if (p[0] === 'stats' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
    const { data: orders } = await supabase.from('orders').select('*')
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
    
    const revenue = (orders||[]).filter(o=>o.status!=='cancelled').reduce((s,o)=>s+(o.total||0),0)
    const pending = (orders||[]).filter(o=>o.status==='pending').length
    const { data: lowStock } = await supabase.from('products').select('name, stock_quantity').lt('stock_quantity', 20).limit(10)
    
    const byDay = {}
    for (let i=6;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); const k = d.toISOString().slice(0,10); byDay[k]=0 }
    (orders||[]).forEach(o=>{ const k = new Date(o.placed_at).toISOString().slice(0,10); if (k in byDay) byDay[k]++ })
    
    return json({ products: productsCount, orders: orders?.length||0, users: usersCount, revenue, pending, lowStock: lowStock||[], byDay })
  }

  // ==================== CATALOG ACCESS REQUESTS ====================
  if (p[0] === 'catalog-requests' && method === 'GET' && p[1] === 'my-status') {
    if (!user) return err('Unauthorized', 401)
    const { data: reqs } = await supabase
      .from('catalog_access_requests')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    const pending = (reqs || []).find(r => r.status === 'pending')
    const latest = (reqs || [])[0] || null

    return json({
      hasPending: Boolean(pending),
      status: latest?.status || 'none',
      request: pending || latest
    })
  }

  if (p[0] === 'catalog-requests' && method === 'POST') {
    if (!user) return err('Unauthorized', 401)
    const now = new Date().toISOString()
    const customerName = user.full_name || user.name || user.email?.split('@')[0] || 'Customer'

    // Check duplicate pending request
    try {
      const { data: existing } = await supabase
        .from('catalog_access_requests')
        .select('id, status')
        .eq('customer_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (existing) {
        return err('You already have a pending request.', 400)
      }
    } catch (e) {
      console.log('Error checking existing catalog requests:', e?.message)
    }

    const requestRecord = {
      id: uuidv4(),
      customer_id: user.id,
      customer_name: customerName,
      email: user.email || '',
      message: body.note || body.message || 'Requested catalog access & custom pricing setup',
      status: 'pending',
      created_at: now,
      updated_at: now
    }

    // Insert into public.catalog_access_requests (triggers Supabase Realtime CDC event to Admin)
    let requestStored = false
    try {
      const { error: insErr } = await supabase.from('catalog_access_requests').insert(requestRecord)
      if (!insErr) requestStored = true
    } catch (tErr) {
      console.log('catalog_access_requests table insert error:', tErr?.message)
    }

    // Also attempt catalog_requests backup table
    try {
      await supabase.from('catalog_requests').insert({
        id: requestRecord.id,
        customer_id: user.id,
        customer_name: customerName,
        email: user.email || '',
        note: requestRecord.message,
        status: 'pending',
        created_at: now
      })
    } catch (e) {}

    // Fallback: store in settings JSON column
    try {
      const { data: store } = await supabase.from('settings').select('b2b_catalog_requests').eq('id', 'main').maybeSingle()
      let reqList = store?.b2b_catalog_requests || []
      reqList.unshift(requestRecord)
      await supabase.from('settings').upsert({ id: 'main', b2b_catalog_requests: reqList, updated_at: now })
    } catch (sErr) {}

    // Log Activity Event for Admin Realtime Dashboard Feed
    try {
      await supabase.from('activity_logs').insert({
        id: uuidv4(),
        user_id: user.id,
        user_name: customerName,
        user_email: user.email || '',
        event_type: 'catalog_request',
        category: 'customers',
        title: `New Catalog Request by ${customerName}`,
        description: `${customerName} (${user.email}) requested catalog access.`,
        created_at: now
      })
    } catch (actErr) {}

    return json({ ok: true, request: requestRecord })
  }

  if (p[0] === 'admin' && p[1] === 'catalog-requests') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    if (method === 'GET') {
      const { data: dbData } = await supabase.from('catalog_access_requests').select('*').order('created_at', { ascending: false })
      const { data: backupData } = await supabase.from('catalog_requests').select('*').order('created_at', { ascending: false })
      const { data: store } = await supabase.from('settings').select('b2b_catalog_requests').eq('id', 'main').maybeSingle()
      const fallbackData = store?.b2b_catalog_requests || []

      const mergedMap = new Map()
      for (const item of (dbData || [])) {
        if (item && item.id) mergedMap.set(item.id, item)
      }
      for (const item of (backupData || [])) {
        if (item && item.id && !mergedMap.has(item.id)) mergedMap.set(item.id, item)
      }
      for (const item of (fallbackData || [])) {
        if (item && item.id && !mergedMap.has(item.id)) mergedMap.set(item.id, item)
      }

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      return json(mergedList)
    }

    if (method === 'PUT' && p[2]) {
      const requestId = p[2]
      const { status, customer_id } = body
      const now = new Date().toISOString()
      const finalStatus = status || 'approved'

      try {
        await supabase.from('catalog_access_requests').update({ status: finalStatus, updated_at: now }).eq('id', requestId)
      } catch (uErr) {}

      try {
        await supabase.from('catalog_requests').update({ status: finalStatus, updated_at: now }).eq('id', requestId)
      } catch (uErr) {}

      // Update settings JSON fallback
      try {
        const { data: store } = await supabase.from('settings').select('b2b_catalog_requests').eq('id', 'main').maybeSingle()
        let reqList = store?.b2b_catalog_requests || []
        const idx = reqList.findIndex(r => r.id === requestId)
        if (idx >= 0) {
          reqList[idx] = { ...reqList[idx], status: finalStatus, updated_at: now }
        }
        await supabase.from('settings').upsert({ id: 'main', b2b_catalog_requests: reqList, updated_at: now })
      } catch (sErr) {}

      // If approved, update user profile and unlock catalog access
      if (finalStatus === 'approved' && customer_id) {
        try {
          await supabase.from('users').update({ catalog_access: true, updated_at: now }).eq('id', customer_id)
        } catch (usrErr) {}
      }

      return json({ ok: true, status: finalStatus })
    }
  }

  // ==================== ADMIN CUSTOMER LOGINS ACTIVITY LOG ====================
  if (p[0] === 'admin' && p[1] === 'customer-logins' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()

    // Fetch unique customer accounts from users table
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, created_at')
      .neq('role', 'admin')
      .order('created_at', { ascending: false })

    // Fetch latest login activity per user from customer_logins
    const { data: loginsData } = await supabase
      .from('customer_logins')
      .select('user_id, login_at')
      .order('login_at', { ascending: false })

    const lastLoginMap = {}
    if (loginsData) {
      for (const l of loginsData) {
        if (l.user_id && !lastLoginMap[l.user_id]) {
          lastLoginMap[l.user_id] = l.login_at
        }
      }
    }

    const roster = (usersData || []).map(u => ({
      id: u.id,
      full_name: u.full_name || u.email.split('@')[0],
      email: u.email,
      phone: u.phone && u.phone.trim() ? u.phone : 'Not provided',
      created_at: u.created_at || new Date().toISOString(),
      last_login_at: lastLoginMap[u.id] || u.created_at || null
    }))

    return json(roster)
  }

  if (p[0] === 'admin' && p[1] === 'activity-logs' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const filterType = url.searchParams.get('type') || 'all'
    const searchQuery = (url.searchParams.get('search') || '').toLowerCase().trim()

    let logs = []
    try {
      const { data: dbLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (Array.isArray(dbLogs) && dbLogs.length > 0) {
        logs = dbLogs
      }
    } catch (e) {}

    if (logs.length === 0) {
      try {
        const { data: store } = await supabase.from('settings')
          .select('marquee_messages')
          .eq('id', 'admin_activity_feed')
          .maybeSingle()
        if (store?.marquee_messages) {
          logs = store.marquee_messages.map(s => {
            try { return typeof s === 'string' ? JSON.parse(s) : s } catch { return null }
          }).filter(Boolean)
        }
      } catch (e) {}
    }

    // Merge recent logins & orders into activity stream if logs are sparse
    if (logs.length < 5) {
      try {
        const { data: logins } = await supabase.from('customer_logins').select('*').order('login_at', { ascending: false }).limit(20)
        if (Array.isArray(logins)) {
          logins.forEach(l => {
            logs.push({
              id: l.id || String(Math.random()),
              user_id: l.user_id,
              user_name: l.user_name || 'Customer',
              user_email: l.email || '',
              event_type: 'login',
              title: `${l.user_name || 'Customer'} logged in`,
              description: `Logged in via portal at ${new Date(l.login_at || Date.now()).toLocaleTimeString('en-IN')}`,
              created_at: l.login_at || new Date().toISOString()
            })
          })
        }
        const { data: recentOrders } = await supabase.from('orders').select('*').order('placed_at', { ascending: false }).limit(20)
        if (Array.isArray(recentOrders)) {
          recentOrders.forEach(o => {
            logs.push({
              id: 'ord-' + o.id,
              user_id: o.user_id,
              user_name: o.customer_name || 'Customer',
              user_email: '',
              event_type: 'order',
              title: `Placed Order #${o.order_number || o.id.slice(0, 6)}`,
              description: `Order total ₹${Number(o.total || 0).toLocaleString('en-IN')}`,
              metadata: { order_id: o.id, amount: o.total },
              created_at: o.placed_at || o.created_at || new Date().toISOString()
            })
          })
        }
      } catch (e) {}
    }

    // Deduplicate & Sort descending by created_at
    const map = new Map()
    logs.forEach(item => {
      if (item && item.id && !map.has(item.id)) map.set(item.id, item)
    })
    let result = Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Apply Filter Type
    if (filterType !== 'all') {
      result = result.filter(item => {
        if (filterType === 'orders') return item.event_type === 'order' || item.event_type === 'cancel_order'
        if (filterType === 'logins') return item.event_type === 'login' || item.event_type === 'logout' || item.event_type === 'signup'
        if (filterType === 'payments') return item.event_type === 'payment'
        if (filterType === 'customers') return item.event_type === 'profile_update' || item.event_type === 'wishlist'
        if (filterType === 'system') return item.event_type === 'system'
        return true
      })
    }

    // Apply Search Query
    if (searchQuery) {
      result = result.filter(item => 
        (item.user_name || '').toLowerCase().includes(searchQuery) ||
        (item.user_email || '').toLowerCase().includes(searchQuery) ||
        (item.title || '').toLowerCase().includes(searchQuery) ||
        (item.description || '').toLowerCase().includes(searchQuery)
      )
    }

    return json(result.slice(0, 100))
  }

  if (p[0] === 'admin' && p[1] === 'activity-logs' && method === 'POST') {
    const { user_id, user_name, user_email, user_avatar, event_type, title, description, metadata } = body || {}
    const record = {
      id: uuidv4(),
      user_id: user_id || user?.id || null,
      user_name: user_name || user?.name || 'Customer',
      user_email: user_email || user?.email || '',
      user_avatar: user_avatar || '',
      event_type: event_type || 'system',
      title: title || 'Activity Event',
      description: description || '',
      metadata: metadata || {},
      is_read: false,
      created_at: new Date().toISOString()
    }

    try {
      await supabase.from('activity_logs').insert(record)
    } catch (e) {}

    try {
      const { data: store } = await supabase.from('settings')
        .select('marquee_messages')
        .eq('id', 'admin_activity_feed')
        .maybeSingle()
      let list = []
      if (store?.marquee_messages) {
        list = store.marquee_messages.map(s => {
          try { return typeof s === 'string' ? JSON.parse(s) : s } catch { return null }
        }).filter(Boolean)
      }
      list.unshift(record)
      list = list.slice(0, 100)
      await supabase.from('settings').upsert({
        id: 'admin_activity_feed',
        marquee_messages: list.map(r => JSON.stringify(r))
      })
    } catch (e) {}

    return json({ ok: true, record })
  }

  if (p[0] === 'realtime-config' && method === 'GET') {
    return json({ 
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_KEY 
    })
  }

  if (p[0] === 'newsletter' && method === 'POST') {
    const { email } = body
    if (!email) return err('Email required')
    await supabase.from('newsletter').upsert({ email, subscribed_at: new Date().toISOString() })
    return json({ ok: true })
  }

  if (p[0] === 'contact' && method === 'POST') {
    const { name, email, phone, message } = body
    await supabase.from('inquiries').insert({ id: uuidv4(), name, email, phone, message, created_at: new Date().toISOString() })
    return json({ ok: true })
  }

  if (p[0] === 'settings') {
    if (method === 'GET') {
      const { data: s } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
      return json(s || {}, 200, 300)
    }
    if (method === 'PUT') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('settings').upsert({ id: 'main', ...body, updated_at: new Date().toISOString() })
      return json({ ok: true })
    }
  }

  if (p[0] === 'banners') {
    if (method === 'GET') {
      const { data: list } = await supabase.from('banners').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      return json(list || [], 200, 300)
    }
    if (method === 'POST') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const doc = { id: uuidv4(), ...body, is_active: body.is_active !== false, created_at: new Date().toISOString() }
      await supabase.from('banners').insert(doc)
      return json(doc)
    }
    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('banners').update(body).eq('id', p[1])
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('banners').delete().eq('id', p[1])
      return json({ ok: true })
    }
  }

  if (p[0] === 'clients') {
    if (method === 'GET') {
      const { data: list } = await supabase.from('clients').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      return json(list || [], 200, 300)
    }
    if (method === 'POST') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const doc = { id: uuidv4(), ...body, is_active: body.is_active !== false, created_at: new Date().toISOString() }
      await supabase.from('clients').insert(doc)
      return json(doc)
    }
    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('clients').update(body).eq('id', p[1])
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('clients').delete().eq('id', p[1])
      return json({ ok: true })
    }
  }

  // ==================== CUSTOMER SUPPORT CHATBOT ====================
  if (p[0] === 'chat' && method === 'POST') {
    const { message, history, sessionId } = body
    if (!message || !sessionId) return err('Message and sessionId required')
    
    const now = new Date().toISOString()
    const msgLower = message.toLowerCase().trim()
    let responseText = ''
    let suggestions = []
    let fallbackToAI = false
    let isWhatsAppHandoff = false
    
    const supabase = db()
    const user = await getUser(req)
    
    // Helper to log conversation in Supabase chat_logs
    const logChat = async (finalResponseText) => {
      try {
        const updatedHistory = [
          ...(history || []),
          { sender: 'user', text: message, timestamp: now },
          { sender: 'bot', text: finalResponseText, timestamp: new Date().toISOString() }
        ]
        
        const { data: existingLog } = await supabase
          .from('chat_logs')
          .select('id')
          .eq('session_id', sessionId)
          .maybeSingle()
          
        if (existingLog) {
          await supabase
            .from('chat_logs')
            .update({ 
              messages: updatedHistory, 
              user_id: user?.id || null,
              updated_at: new Date().toISOString() 
            })
            .eq('id', existingLog.id)
        } else {
          await supabase
            .from('chat_logs')
            .insert({
              session_id: sessionId,
              user_id: user?.id || null,
              messages: updatedHistory,
              created_at: now,
              updated_at: now
            })
        }
      } catch (e) {
        console.error('Error logging chat conversation:', e)
      }
    }

    // 1. RULE-BASED LAYER
    
    // A. Order Tracking:
    const trackingRegex = /(track\s+)?(AK\d{8}|[0-9a-fA-F-]{36})(?:\s+(\+?\d{10,12}))?/i
    const trackingMatch = msgLower.match(trackingRegex)
    
    if (msgLower.includes('track') || trackingMatch) {
      if (trackingMatch) {
        const orderIdentifier = trackingMatch[2].toUpperCase()
        const providedPhone = trackingMatch[3]
        
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .select('*, address:addresses(*)')
          .or(`order_number.eq.${orderIdentifier},id.eq.${orderIdentifier}`)
          .maybeSingle()
          
        if (orderErr || !order) {
          responseText = `We couldn't find an order matching "${orderIdentifier}". Please double-check your order number and try again.`
          suggestions = ['Track my order', 'Shipping info', 'Talk to a human']
        } else {
          let isVerified = false
          if (user && order.user_id === user.id) {
            isVerified = true
          } else if (providedPhone) {
            const cleanedDBPhone = String(order.address?.phone || '').replace(/\D/g, '')
            const cleanedProvidedPhone = String(providedPhone).replace(/\D/g, '')
            if (cleanedDBPhone.endsWith(cleanedProvidedPhone) || cleanedProvidedPhone.endsWith(cleanedDBPhone)) {
              isVerified = true
            }
          }
          
          if (isVerified) {
            responseText = `📦 Order **#${order.order_number}** Status:\n\n` +
              `• **Current Status:** ${order.status.toUpperCase()}\n` +
              `• **Placed On:** ${new Date(order.placed_at).toLocaleDateString('en-IN')}\n` +
              `• **Items Total:** ₹${order.total.toLocaleString('en-IN')}\n` +
              `• **Payment Method:** ${order.payment_method}\n` +
              `• **Delivery to:** ${order.address?.full_name}, ${order.address?.city}\n\n` +
              `If you have any queries about delivery, click "Talk to a human" to contact support.`;
            suggestions = ['Talk to a human', 'Shipping info', 'Browse products']
          } else {
            responseText = `For security reasons, please verify your order by providing the phone number used at checkout. Reply in this format:\n\n"track ${orderIdentifier} [phone number]"\n\nExample: "track ${orderIdentifier} 9876543210"`
            suggestions = ['Talk to a human', 'Main menu']
          }
        }
      } else {
        if (user) {
          const { data: latestOrder } = await supabase
            .from('orders')
            .select('order_number')
            .eq('user_id', user.id)
            .order('placed_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            
          if (latestOrder) {
            responseText = `To track your order, please enter your order number. It looks like your latest order number is **${latestOrder.order_number}**. You can type:\n\n"track ${latestOrder.order_number}"`
          } else {
            responseText = `Please type your order number to track it. Example:\n\n"track AK98765432"`
          }
        } else {
          responseText = `To track your order, please reply with your order number and the phone number used to place it, in this format:\n\n"track [order number] [phone number]"\n\nExample: "track AK98765432 9876543210"`
        }
      }
    }
    
    // B. Product Search:
    if (!responseText) {
      const productTriggers = ['available', 'do you have', 'price of', 'search', 'buy', 'stock', 'catalog']
      const hasTrigger = productTriggers.some(t => msgLower.includes(t))
      
      let searchKeyword = ''
      if (hasTrigger) {
        searchKeyword = message.replace(/(available|do you have|price of|search|buy|stock|any|catalog|\?)/gi, '').trim()
      } else if (msgLower.length > 2 && msgLower.length < 25 && !msgLower.includes('help') && !msgLower.includes('menu') && !msgLower.includes('shipping') && !msgLower.includes('hours') && !msgLower.includes('payment') && !msgLower.includes('return')) {
        searchKeyword = message.trim()
      }
      
      if (searchKeyword && searchKeyword.length > 2) {
        const { data: products } = await supabase
          .from('products')
          .select('name, price, stock_quantity, slug, is_active')
          .ilike('name', `%${searchKeyword}%`)
          .eq('is_active', true)
          .limit(3)
          
        if (products && products.length > 0) {
          responseText = `🛍️ Here are the items we found in our catalog for "${searchKeyword}":\n\n`
          products.forEach(p => {
            const stockStatus = p.stock_quantity > 0 ? `✅ In Stock (${p.stock_quantity} left)` : `❌ Out of Stock`
            responseText += `• **${p.name}**\n` +
              `  Price: ₹${p.price.toLocaleString('en-IN')}\n` +
              `  Availability: ${stockStatus}\n` +
              `  [View Product Details](/product/${p.slug})\n\n`
          })
          suggestions = ['How to order', 'Payment Methods', 'Browse products']
        }
      }
    }
    
    // C. FAQ Intent:
    if (!responseText) {
      const { data: dbFaqs } = await supabase
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true })
        
      if (dbFaqs && dbFaqs.length > 0) {
        for (const faq of dbFaqs) {
          const qWords = faq.question.toLowerCase().replace(/[^\w\s]/g, '').split(' ').filter(w => w.length > 3)
          let matchCount = 0
          qWords.forEach(qw => {
            if (msgLower.includes(qw)) matchCount++
          })
          
          if (msgLower.includes(faq.question.toLowerCase()) || (qWords.length > 0 && matchCount >= qWords.length * 0.6)) {
            responseText = faq.answer
            suggestions = dbFaqs.filter(f => f.id !== faq.id).slice(0, 3).map(f => f.question)
            break
          }
        }
      }
    }

    // D. WhatsApp handoff/contact intent:
    if (!responseText) {
      if (msgLower.includes('human') || msgLower.includes('agent') || msgLower.includes('whatsapp') || msgLower.includes('support') || msgLower.includes('talk to') || msgLower.includes('contact') || msgLower.includes('person') || msgLower.includes('number')) {
        responseText = `Sure! I can connect you directly to our human customer support team on WhatsApp. Click the button below to start chatting.`
        isWhatsAppHandoff = true
        suggestions = ['Track my order', 'Shipping info', 'Talk to a human']
      }
    }
    
    // 2. AI FALLBACK LAYER:
    if (!responseText) {
      fallbackToAI = true
      const openRouterKey = process.env.OPENROUTER_API_KEY
      
      if (!openRouterKey) {
        console.warn('OPENROUTER_API_KEY is not defined in the environment variables')
        responseText = `I'm currently offline. Let me connect you directly with our customer support team on WhatsApp for any inquiries.`
        isWhatsAppHandoff = true
        suggestions = ['Talk to a human', 'Browse products', 'Business hours']
      } else {
        try {
          const systemPrompt = `You are a helpful and polite B2B Customer Support AI assistant for "AK Enterprises", a trusted corporate supplier in Pune, India, established in 2020.
We specialize in:
1. Office Stationery (files, notebooks, writing materials, office electronics)
2. Housekeeping Supplies (cleaning chemicals, garbage bags, tissues, floor tools)
3. UPS & Power Solutions (UPS systems, industrial batteries)

Brand details:
- Delivery: Pan-India B2B delivery. Same-day dispatch in Maharashtra, next-day delivery.
- Shipping: Free for orders above ₹2,000. Flat ₹150 for orders below ₹2,000.
- Payment: COD (Cash on Delivery) is standard. Net banking/Invoice credit available for registered bulk clients.
- Custom Quote: Custom bulk quotes generated in 2 hours.

Tone & Formatting: Professional, friendly, helpful, concise, corporate. Speak in clear English (or Hinglish if the user asks in Hindi).
Always prefer concise, mobile-friendly markdown formatting (e.g. bold **text** for emphasis). Use short bullet points or numbered lists instead of wide markdown tables where possible, as tables are hard to read on narrow phone screens. Keep responses brief.

Current Conversation History:\n` +
          (history || []).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
          
          const payload = {
            model: "openrouter/free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 400
          }
          
          const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openRouterKey}`,
              "HTTP-Referer": "https://akenterprises.in",
              "X-Title": "AK Enterprises B2B Chatbot"
            },
            body: JSON.stringify(payload)
          })
          
          if (!orRes.ok) {
            const errBody = await orRes.text()
            console.error("OpenRouter API request failed:", {
              status: orRes.status,
              statusText: orRes.statusText,
              body: errBody
            })
            throw new Error(`OpenRouter returned status ${orRes.status}: ${errBody}`)
          }
          
          const orData = await orRes.json()
          responseText = orData.choices?.[0]?.message?.content || "I couldn't generate a response. Let me connect you to our support team."
          suggestions = ['Talk to a human', 'Track my order', 'Shipping charges']
        } catch (e) {
          console.error("OpenRouter API failure:", e)
          responseText = `I'm having trouble processing your query right now. Let me connect you directly to our support team on WhatsApp!`
          isWhatsAppHandoff = true
          suggestions = ['Talk to a human', 'Browse products']
        }
      }
    }
    
    await logChat(responseText)
    
    return json({
      text: responseText,
      suggestions,
      isWhatsAppHandoff,
      fallbackToAI,
      timestamp: new Date().toISOString()
    })
  }

  // ==================== FAQ MANAGEMENT ====================
  if (p[0] === 'admin' && p[1] === 'faqs') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const now = new Date().toISOString()
    const supabase = db()
    
    if (method === 'GET') {
      const { data } = await supabase.from('faqs').select('*').order('sort_order', { ascending: true })
      return json(data || [])
    }
    if (method === 'POST') {
      const doc = { id: uuidv4(), ...body, created_at: now, updated_at: now }
      const { error } = await supabase.from('faqs').insert(doc)
      if (error) return err(error.message, 500)
      return json(doc)
    }
    if (method === 'PUT' && p[2]) {
      const { error } = await supabase.from('faqs').update({ ...body, updated_at: now }).eq('id', p[2])
      if (error) return err(error.message, 500)
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[2]) {
      const { error } = await supabase.from('faqs').delete().eq('id', p[2])
      if (error) return err(error.message, 500)
      return json({ ok: true })
    }
  }

  // ==================== CHAT LOGS ====================
  if (p[0] === 'admin' && p[1] === 'chat-logs') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    
    if (method === 'GET') {
      const { data } = await supabase.from('chat_logs').select('*').order('updated_at', { ascending: false })
      return json(data || [])
    }
    if (method === 'DELETE' && p[2]) {
      const { error } = await supabase.from('chat_logs').delete().eq('id', p[2])
      if (error) return err(error.message, 500)
      return json({ ok: true })
    }
  }

  // ==================== PRODUCT BRANDS ====================
  if (p[0] === 'products' && p[1] === 'brands' && method === 'GET') {
    const supabase = db()
    const { data } = await supabase.from('products').select('brand')
    const brands = Array.from(new Set((data || []).map(p => p.brand).filter(Boolean)))
    return json(brands)
  }

  // ==================== PRODUCT Q&A ====================
  if (p[0] === 'products' && p[2] === 'qa') {
    const supabase = db()
    const { data: prod } = await supabase.from('products').select('id').or(`slug.eq.${p[1]},id.eq.${p[1]}`).maybeSingle()
    if (!prod) return err('Product not found', 404)
    
    if (method === 'GET') {
      const { data } = await supabase
        .from('product_qa')
        .select('*')
        .eq('product_id', prod.id)
        .order('created_at', { ascending: false })
      return json(data || [])
    }
    if (method === 'POST') {
      if (!user) return err('Unauthorized', 401)
      const { question } = body
      if (!question) return err('Question is required')
      const newQa = {
        id: uuidv4(),
        product_id: prod.id,
        user_id: user.id,
        user_email: user.email,
        question,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const { error } = await supabase.from('product_qa').insert(newQa)
      if (error) return err('Failed to post question: ' + error.message, 500)
      return json(newQa)
    }
  }

  // ==================== ADMIN Q&A ====================
  if (p[0] === 'admin' && p[1] === 'qa') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    if (method === 'GET') {
      const { data } = await supabase
        .from('product_qa')
        .select('*, products(name, slug)')
        .order('created_at', { ascending: false })
      const mapped = (data || []).map(item => ({
        ...item,
        product_name: item.products?.name || 'Product',
        product_slug: item.products?.slug || ''
      }))
      return json(mapped)
    }
    if (method === 'PUT' && p[2]) {
      const { answer } = body
      const { error } = await supabase
        .from('product_qa')
        .update({ 
          answer, 
          answered_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', p[2])
      if (error) return err('Failed to save answer: ' + error.message, 500)
      return json({ ok: true })
    }
  }

  // ==================== B2B CUSTOMER PRICING (ADMIN) ====================
  if (p[0] === 'admin' && p[1] === 'customer-pricing') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    
    if (method === 'GET') {
      const customerId = url.searchParams.get('customer_id')
      if (!customerId) return err('Customer ID is required', 400)
      
      const { data: allProds } = await supabase.from('products').select('*, product_images(image_url), categories(name, slug)').order('name', { ascending: true })
      const pricingList = await getCustomerPricings(customerId)
      const pricingMap = new Map(pricingList.map(p => [p.product_id, p]))

      const mapped = (allProds || []).map(prod => {
        const item = pricingMap.get(prod.id)
        const firstImg = prod.product_images?.[0]?.image_url || prod.images?.[0] || '/placeholder-product.png'
        return {
          product_id: prod.id,
          product_name: prod.name,
          category_name: prod.categories?.name || 'General',
          default_price: prod.price,
          custom_price: item ? item.custom_price : prod.price,
          is_visible: item ? item.is_visible : false,
          is_overridden: !!item,
          image_url: firstImg,
          images: prod.product_images?.map(i => i.image_url) || [firstImg]
        }
      })

      const assignedCount = mapped.filter(m => m.is_visible).length
      return json({ customer_id: customerId, products: mapped, assigned_count: assignedCount })
    }

    if (method === 'POST') {
      const { action_type, batch_updates } = body
      if (Array.isArray(batch_updates) && batch_updates.length > 0) {
        console.log(`[admin/customer-pricing BATCH] Saving ${batch_updates.length} updates`)
        for (const item of batch_updates) {
          await saveCustomerPricing({
            customer_id: item.customer_id,
            product_id: item.product_id,
            custom_price: item.custom_price,
            is_visible: item.is_visible
          })
        }
        return json({ ok: true, count: batch_updates.length })
      } else if (action_type) {
        const { customer_id, product_ids, category_id, value, is_visible } = body
        if (!customer_id) return err('Customer ID required', 400)
        console.log(`[admin/customer-pricing BULK] Saving for customer_id=${customer_id} action=${action_type} is_visible=${is_visible}`)
        await bulkUpdateCustomerPricing({ customer_id, product_ids, category_id, action_type, value, is_visible })
        return json({ ok: true })
      } else {
        const { customer_id, product_id, custom_price, is_visible } = body
        if (!customer_id || !product_id) return err('Customer ID and Product ID required', 400)
        console.log(`[admin/customer-pricing SINGLE] Saving: customer_id=${customer_id} product_id=${product_id} price=${custom_price} visible=${is_visible}`)
        await saveCustomerPricing({ customer_id, product_id, custom_price, is_visible })
        return json({ ok: true })
      }
    }
  }

  // ==================== B2B INVENTORY LEDGER (ADMIN) ====================
  if (p[0] === 'admin' && p[1] === 'inventory') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    
    if (p[2] === 'movements' && method === 'GET') {
      const movements = await getStockMovements()
      return json(movements)
    }

    if (p[2] === 'intake' && method === 'POST') {
      const { product_id, quantity, reference, notes } = body
      if (!product_id || !quantity) return err('Product and quantity required', 400)
      const record = await addStockMovement({ product_id, movement_type: 'intake', quantity, reference, notes, created_by: user.id })
      return json(record)
    }

    if (p[2] === 'outward' && method === 'POST') {
      const { product_id, quantity, reference, notes } = body
      if (!product_id || !quantity) return err('Product and quantity required', 400)
      try {
        const record = await addStockMovement({ product_id, movement_type: 'outward', quantity, reference, notes, created_by: user.id })
        return json(record)
      } catch (e) {
        return err(e.message, 400)
      }
    }
  }

  // ==================== ADMIN CREATE ACCOUNT (CUSTOMERS & VENDORS) ====================
  if (p[0] === 'admin' && p[1] === 'create-account' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)

    const { full_name, email, phone, password, role = 'customer' } = body
    if (!full_name || !email || !password) return err('Full Name, Email, and Password required', 400)

    const cleanEmail = email.trim().toLowerCase()

    // Check if user already exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', cleanEmail).maybeSingle()
    if (existingUser) return err('An account with this email address already exists', 409)

    // 1. Create in Supabase Auth
    const { data: newAuthUser, error: authErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    })

    let newUuid = newAuthUser?.user?.id
    if (authErr || !newUuid) {
      console.error('[Admin Create Account Auth Fail]:', authErr)
      return err('Failed to create authentication user: ' + (authErr?.message || 'Unknown error'), 500)
    }

    // 2. Insert into custom public.users table
    const nowStr = new Date().toISOString()
    const refCode = 'AKREF' + Math.random().toString(36).substring(2, 8).toUpperCase()

    const baseUserPayload = {
      id: newUuid,
      email: cleanEmail,
      password: hashPw(password),
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : '',
      role: role === 'vendor' ? 'vendor' : 'customer',
      created_at: nowStr
    }

    let { error: dbErr } = await supabase.from('users').insert({
      ...baseUserPayload,
      status: 'active',
      catalog_access: true,
      referral_code: refCode
    })

    if (dbErr && (dbErr.message?.includes('catalog_access') || dbErr.message?.includes('status') || dbErr.message?.includes('referral_code') || dbErr.message?.includes('schema cache'))) {
      console.warn('[Admin Create Account]: Retrying insert with core user fields')
      const resFallback = await supabase.from('users').insert(baseUserPayload)
      dbErr = resFallback.error
    }

    if (dbErr) {
      console.error('[Admin Create Account DB Fail]:', dbErr)
      await supabase.auth.admin.deleteUser(newUuid)
      return err('Failed to create user database record: ' + dbErr.message, 500)
    }

    // 3. If role === 'vendor', also ensure entry in vendors table
    if (role === 'vendor') {
      await saveVendor({ name: full_name, phone: phone || '', email: cleanEmail, user_id: newUuid })
    }

    return json({
      success: true,
      user: {
        id: newUuid,
        full_name,
        email: cleanEmail,
        phone: phone || '',
        role: role === 'vendor' ? 'vendor' : 'customer',
        temporary_password: password
      }
    })
  }

  // ==================== ADMIN RESET & SHARE USER CREDENTIALS ====================
  if (p[0] === 'admin' && p[1] === 'reset-password' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)

    const { user_id, email, new_password } = body
    if ((!user_id && !email) || !new_password) return err('User ID/Email and New Password required', 400)

    let targetUserId = user_id
    let targetEmail = email
    let targetUserObj = null

    if (!targetUserId && email) {
      const { data: u } = await supabase.from('users').select('id, email, full_name, phone, role').eq('email', email.trim().toLowerCase()).maybeSingle()
      if (!u) return err('User account not found', 404)
      targetUserId = u.id
      targetEmail = u.email
      targetUserObj = u
    } else if (targetUserId) {
      const { data: u } = await supabase.from('users').select('id, email, full_name, phone, role').eq('id', targetUserId).maybeSingle()
      if (u) {
        targetEmail = u.email
        targetUserObj = u
      }
    }

    // 1. Update password in Supabase Auth
    const { error: authErr } = await supabase.auth.admin.updateUserById(targetUserId, { password: new_password })
    if (authErr) {
      console.error('[Admin Reset Password Auth Fail]:', authErr)
      return err('Failed to update authentication password: ' + authErr.message, 500)
    }

    // 2. Update password in custom public.users table
    await supabase.from('users').update({ password: hashPw(new_password) }).eq('id', targetUserId)

    return json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: targetUserId,
        full_name: targetUserObj?.full_name || 'User',
        email: targetEmail,
        phone: targetUserObj?.phone || '',
        role: targetUserObj?.role || 'customer',
        temporary_password: new_password
      }
    })
  }

  // ==================== VENDORS MANAGEMENT (ADMIN) ====================
  if (p[0] === 'admin' && p[1] === 'vendors') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    
    if (method === 'GET') {
      const vendors = await getVendorsList()
      return json(vendors)
    }

    if (method === 'POST') {
      const { name, phone, email, password } = body
      if (!name || !email || !password) return err('Name, Email, and Password required', 400)

      const { data: newAuthUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      let userId = newAuthUser?.user?.id || uuidv4()

      if (!authErr && newAuthUser?.user) {
        await supabase.from('users').insert({
          id: userId,
          email,
          password: hashPw(password),
          full_name: name,
          phone: phone || '',
          role: 'vendor',
          created_at: new Date().toISOString()
        })
      }

      const vendor = await saveVendor({ name, phone, email, user_id: userId })
      return json(vendor)
    }
  }

  // ==================== VENDOR PORTAL (VENDOR ROLE) ====================
  if (p[0] === 'vendor' && p[1] === 'orders') {
    if (!user) return err('Unauthorized', 401)
    const vendor = await getVendorByUserId(user.id, user.email)
    
    if (!vendor && user.role !== 'admin') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Vendor Audit] User ${user.email} (ID: ${user.id}) has role=vendor but no record in vendors table yet. Returning empty orders list.`)
      }
      return json([])
    }

    if (method === 'GET') {
      // NOTE: vendor_accepted & vendor_accepted_at columns do NOT exist in DB.
      // Derive vendor_accepted from status field instead.
      let query = supabase.from('orders').select('id, order_number, status, total, payment_method, placed_at, updated_at, addresses(*), order_items(id, product_name_snapshot, quantity)')
      if (user.role !== 'admin' && vendor) {
        query = query.eq('assigned_vendor_id', vendor.id)
      }

      const { data: orders, error } = await query.order('placed_at', { ascending: false })
      if (error) {
        console.error('[Vendor Orders Query Fail]:', { table: 'orders', code: error.code, message: error.message })
        return err('Failed to fetch assigned orders: ' + error.message, 500)
      }

      const VENDOR_ACCEPTED_STATUSES = ['vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered']
      const mapped = (orders || []).map(o => {
        const { status: statusStr, history: statusHistory } = buildStatusHistory(o)
        return {
          id: o.id,
          order_number: o.order_number,
          status: statusStr,
          vendor_accepted: VENDOR_ACCEPTED_STATUSES.includes(o.status),
          vendor_accepted_at: null,
          total_amount: o.total || 0,
          status_history: statusHistory,
          placed_at: o.placed_at,
          address: o.addresses,
          items: o.order_items || []
        }
      })

      return json(mapped)
    }

    if (method === 'PUT' && p[2]) {
      const { status, action } = body
      const nowStr = new Date().toISOString()
      // NOTE: vendor_accepted / vendor_accepted_at do NOT exist as DB columns — status field tracks this
      const updateData = { updated_at: nowStr }

      if (action === 'accept' || status === 'accepted' || status === 'vendor_accepted') {
        updateData.status = 'vendor_accepted'
      } else if (status) {
        let normStatus = status
        if (normStatus === 'accepted') normStatus = 'vendor_accepted'
        if (normStatus === 'out for delivery') normStatus = 'out_for_delivery'

        if (!['confirmed', 'vendor_assigned', 'vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'vendor_rejected', 'rejected'].includes(normStatus)) {
          return err('Invalid vendor order status', 400)
        }
        updateData.status = normStatus
      }

      const { error } = await supabase.from('orders').update(updateData).eq('id', p[2])
      if (error) {
        console.error('[Vendor Order Update Fail]:', { table: 'orders', code: error.code, message: error.message })
        return err('Failed to update status: ' + error.message, 500)
      }
      return json({ ok: true, ...updateData })
    }
  }

  // ==================== VENDOR INVENTORY (READ-ONLY) ====================
  if (p[0] === 'vendor' && p[1] === 'inventory' && method === 'GET') {
    if (!user || (user.role !== 'vendor' && user.role !== 'admin')) {
      return err('Forbidden — Vendor access required', 403)
    }

    // NOTE: subcategory column does NOT exist in products table. Use category_id for display.
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, category_id, stock_quantity, is_active')
      .order('name', { ascending: true })

    if (error) {
      console.error('[Vendor Inventory Fetch Fail]:', { table: 'products', code: error.code, message: error.message })
      return json([])
    }

    const mappedProducts = (products || []).map(p => ({
      ...p,
      category: 'General',
      status: p.is_active ? 'Active' : 'Inactive',
      min_stock_alert: 5
    }))

    return json(mappedProducts)
  }

  // ==================== ADMIN BILLING ====================
  if (p[0] === 'admin' && p[1] === 'billing') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)

    if (method === 'GET') {
      const customerId = url.searchParams.get('customer_id')
      const start = url.searchParams.get('start_date')
      const end = url.searchParams.get('end_date')

      let query = supabase.from('orders').select('id, order_number, user_id, total, status, payment_method, payment_status, placed_at, addresses(full_name, city), order_items(*)')
      if (customerId) query = query.eq('user_id', customerId)
      if (start) query = query.gte('placed_at', start)
      if (end) query = query.lte('placed_at', end)

      const { data: orders } = await query.order('placed_at', { ascending: false })
      const { data: usersList } = await supabase.from('users').select('id, email, full_name')
      const userMap = new Map((usersList || []).map(u => [u.id, u]))

      let totalBilled = 0
      let totalReceived = 0
      let totalPending = 0

      const rows = (orders || []).map(o => {
        if (o.status !== 'cancelled' && o.status !== 'rejected') {
          totalBilled += o.total || 0
          if (o.payment_status === 'Received') {
            totalReceived += o.total || 0
          } else {
            totalPending += o.total || 0
          }
        }

        const customer = userMap.get(o.user_id)
        return {
          id: o.id,
          order_number: o.order_number,
          customer_id: o.user_id,
          customer_name: customer?.full_name || o.addresses?.full_name || 'Customer',
          customer_email: customer?.email || '',
          placed_at: o.placed_at,
          total: o.total,
          status: o.status,
          payment_method: o.payment_method || 'COD',
          payment_status: o.payment_status || 'Pending',
          items: o.order_items || []
        }
      })

      return json({
        totalBilled,
        totalReceived,
        totalPending,
        invoices: rows
      })
    }
  }

  // ==================== ADMIN SITE SETTINGS / MOQ ====================
  if (p[0] === 'admin' && p[1] === 'moq') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)

    if (method === 'GET') {
      const moq = await getMinOrderQuantity()
      return json({ min_order_quantity: moq })
    }
    if (method === 'POST' || method === 'PUT') {
      const { min_order_quantity } = body
      const val = await setMinOrderQuantity(min_order_quantity)
      return json({ min_order_quantity: val })
    }
  }

  // ==================== ADMIN REPORTS ====================
  if (p[0] === 'admin' && p[1] === 'reports' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    const start = url.searchParams.get('start_date')
    const end = url.searchParams.get('end_date')
    
    let q = supabase.from('orders').select('*, order_items(*, products(*))')
    if (start) q = q.gte('placed_at', start)
    if (end) q = q.lte('placed_at', end)
    
    const { data: orders, error } = await q
    if (error) return err('Reports calculation error: ' + error.message, 500)
    
    let totalRevenue = 0
    let ordersCount = orders?.length || 0
    const dailySales = {}
    const categoryRevenue = {}
    const productQuantities = {}
    const productNames = {}
    
    for (const ord of (orders || [])) {
      if (ord.status === 'cancelled') continue
      totalRevenue += ord.total
      const dateKey = new Date(ord.placed_at).toISOString().split('T')[0]
      dailySales[dateKey] = (dailySales[dateKey] || 0) + ord.total
      
      for (const it of (ord.order_items || [])) {
        const qty = it.quantity || 0
        const price = it.price_snapshot || 0
        const totalItem = qty * price
        
        const catName = it.products?.subcategory || 'Stationery'
        categoryRevenue[catName] = (categoryRevenue[catName] || 0) + totalItem
        
        const prodId = it.product_id
        productQuantities[prodId] = (productQuantities[prodId] || 0) + qty
        productNames[prodId] = it.product_name_snapshot || 'Product'
      }
    }
    
    const topSelling = Object.keys(productQuantities).map(id => ({
      id,
      name: productNames[id],
      quantity: productQuantities[id]
    })).sort((a,b) => b.quantity - a.quantity).slice(0, 5)
    
    return json({
      totalRevenue,
      ordersCount,
      dailySales,
      categoryRevenue,
      topSelling
    })
  }

  // ==================== ADMIN CUSTOMERS ====================
  if (p[0] === 'admin' && p[1] === 'customers' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    
    const { data: usersList } = await supabase.from('users').select('id, email, full_name, phone, role, created_at')
    const { data: ordersList } = await supabase.from('orders').select('user_id, total, status, placed_at')
    
    const customerMap = {}
    for (const u of (usersList || [])) {
      if (u.role !== 'customer') continue
      customerMap[u.id] = {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        phone: u.phone,
        created_at: u.created_at,
        ordersCount: 0,
        totalSpent: 0,
        lastOrderDate: null
      }
    }
    
    for (const ord of (ordersList || [])) {
      const cust = customerMap[ord.user_id]
      if (cust) {
        if (ord.status !== 'cancelled') {
          cust.totalSpent += ord.total
          cust.ordersCount += 1
          if (!cust.lastOrderDate || new Date(ord.placed_at) > new Date(cust.lastOrderDate)) {
            cust.lastOrderDate = ord.placed_at
          }
        }
      }
    }
    
    return json(Object.values(customerMap))
  }

  // ==================== ADMIN BULK INVOICES ZIP EXPORT ====================
  if (p[0] === 'admin' && p[1] === 'invoices-export' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    const start = url.searchParams.get('start_date')
    const end = url.searchParams.get('end_date')
    
    let q = supabase.from('orders').select('*, address:addresses(*), order_items(*)')
    if (start) q = q.gte('placed_at', start)
    if (end) q = q.lte('placed_at', end)
    
    const { data: orders, error } = await q
    if (error) return err('Failed to fetch invoices: ' + error.message, 500)
    if (!orders || orders.length === 0) return err('No orders found in date range', 404)
    
    const JSZip = require('jszip')
    const zip = new JSZip()
    
    for (const ord of orders) {
      const tax = Math.round(ord.total * 0.18)
      const base = ord.total - tax
      
      const invoiceHtml = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Invoice #${ord.order_number}</title>
    <style>
      body { font-family: sans-serif; padding: 30px; color: #333; }
      .header { border-bottom: 2px solid #800020; padding-bottom: 20px; margin-bottom: 20px; }
      .title { font-size: 24px; font-weight: bold; color: #800020; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
      th { background: #f9f9f9; }
      .total-section { text-align: right; font-size: 16px; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="header">
      <span class="title">AK ENTERPRISES</span><br>
      <span>Trusted Corporate B2B Supplier, Pune</span><br>
      <span>GSTIN: 27AAFFA1411D1Z1 (Placeholder)</span>
    </div>
    <div class="meta-grid">
      <div>
        <strong>Invoice To:</strong><br>
        ${ord.address?.full_name || 'Customer'}<br>
        ${ord.address?.line1 || ''}, ${ord.address?.city || ''}<br>
        Phone: ${ord.address?.phone || ''}
      </div>
      <div style="text-align: right;">
        <strong>Invoice Details:</strong><br>
        Invoice #: ${ord.order_number}<br>
        Date: ${new Date(ord.placed_at).toLocaleDateString()}<br>
        Payment: ${ord.payment_method}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${(ord.order_items || []).map(it => `
          <tr>
            <td>${it.product_name_snapshot || 'Product'}</td>
            <td>${it.quantity}</td>
            <td>₹${it.price_snapshot || 0}</td>
            <td>₹${(it.quantity * (it.price_snapshot || 0)).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="total-section">
      <p>Base Amount: ₹${base.toLocaleString()}</p>
      <p>GST (18%): ₹${tax.toLocaleString()}</p>
      <p style="font-size: 20px; color: #800020;">Grand Total: ₹${ord.total.toLocaleString()}</p>
    </div>
  </body>
  </html>`
      zip.file(`invoice_${ord.order_number}.html`, invoiceHtml)
    }
    
    const content = await zip.generateAsync({ type: 'nodebuffer' })
    
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="invoices_${start || 'all'}_to_${end || 'all'}.zip"`
      }
    })
  }

  // ==================== REFERRAL STATS ====================
  if (p[0] === 'referral' && p[1] === 'stats' && method === 'GET') {
    if (!user) return err('Unauthorized', 401)
    const supabase = db()
    const { data: dbUser } = await supabase.from('users').select('referral_code').eq('id', user.id).maybeSingle()
    const { data: referredList } = await supabase.from('users').select('email, created_at').eq('referred_by_id', user.id)
    
    return json({
      referral_code: dbUser?.referral_code || '',
      referred_count: referredList?.length || 0,
      rewards_earned: (referredList?.length || 0) * 50,
      referred_users: (referredList || []).map(r => ({
        email: r.email.split('@')[0].slice(0, 3) + '***@' + r.email.split('@')[1],
        date: r.created_at
      }))
    })
  }

  return err('Not found', 404)
}

export async function GET(req)    { return route(req, 'GET') }
export async function POST(req)   { return route(req, 'POST') }
export async function PUT(req)    { return route(req, 'PUT') }
export async function DELETE(req) { return route(req, 'DELETE') }
export async function PATCH(req)  { return route(req, 'PATCH') }
