import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { generateInvoicePDF } from '@/lib/invoice-generator'
import { generateChallanPDF } from '@/lib/challan-generator'
import { validateInvoiceData } from '@/lib/invoice-validator'
import { sendOrderConfirmedEmails, sendOrderDeliveredEmails } from '@/lib/email-notifications'
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
import { getDateRange, listISTDays, orderISTDateKey, startOfISTDay, DAY_MS } from '@/lib/date-helpers'

export const maxDuration = 60 // seconds — Hobby plan max limit
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SECRET = process.env.AUTH_SECRET || 'dev-secret'
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] AUTH_SECRET is not set in production environment!')
}
const SEED_VERSION = 'ak-v3-premium'

let _supabase = null
let _seeded = false
function db() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Missing Supabase credentials in .env")
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      }
    })
  }
  return _supabase
}

function extractMetadata(prod) {
  if (!prod) return prod;
  let brand = '';
  let unit = '';
  let weight = '';
  let tags = '';
  let thumbnail = '';
  let gallery_images = [];
  let hsn_code = '';
  let gst_percent = 18;
  let subcategory = '';

  let cleanDescription = prod.description || '';
  const metaMatch = cleanDescription.match(/<!--METADATA:([\s\S]*?)-->/);
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1]);
      brand = meta.brand || '';
      unit = meta.unit || '';
      weight = meta.weight || '';
      tags = meta.tags || '';
      thumbnail = meta.thumbnail || '';
      gallery_images = meta.gallery_images || [];
      hsn_code = meta.hsn_code || '';
      gst_percent = meta.gst_percent !== undefined ? Number(meta.gst_percent) : 18;
      subcategory = meta.subcategory || '';
      
      cleanDescription = cleanDescription.replace(/<!--METADATA:([\s\S]*?)-->/, '').trim();
    } catch (e) {
      console.error('[Metadata Parse Error]:', e);
    }
  }

  return {
    ...prod,
    description: cleanDescription,
    brand: prod.brand || brand,
    unit: prod.unit || unit,
    weight: prod.weight || weight,
    tags: prod.tags || tags,
    thumbnail: prod.thumbnail || thumbnail,
    gallery_images: prod.gallery_images || gallery_images,
    hsn_code: prod.hsn_code || hsn_code,
    gst_percent: prod.gst_percent !== undefined ? Number(prod.gst_percent) : gst_percent,
    subcategory: prod.subcategory || subcategory
  }
}

function injectMetadata(body) {
  const cleanDescription = (body.description || '').replace(/<!--METADATA:([\s\S]*?)-->/, '').trim();
  const extraMetadata = {
    brand: body.brand || '',
    unit: body.unit || '',
    weight: body.weight || '',
    tags: body.tags || '',
    thumbnail: body.thumbnail || '',
    gallery_images: body.gallery_images || body.images || [],
    hsn_code: body.hsn_code || '',
    gst_percent: body.gst_percent !== undefined ? Number(body.gst_percent) : 18,
    subcategory: body.subcategory || ''
  };
  return cleanDescription + '\n\n<!--METADATA:' + JSON.stringify(extraMetadata) + '-->';
}

function hashPw(pw) { return crypto.createHmac('sha256', SECRET).update(pw).digest('hex') }
function sign(payload) {
  // Add a schema version string to force-invalidate older tokens
  const payloadWithVersion = { ...payload, _v: 'v2_gst' }
  const body = Buffer.from(JSON.stringify(payloadWithVersion)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}
function verify(token) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  if (expected !== sig) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString())
    // Enforce token version invalidation
    if (parsed._v !== 'v2_gst') return null
    return parsed
  } catch {
    return null
  }
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
      parsed.id = dbUser.id
      parsed.role = dbUser.role
      parsed.full_name = dbUser.full_name
      parsed.phone = dbUser.phone || ''
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
  if (Array.isArray(o.status_history) && o.status_history.length > 0) {
    return {
      status: statusStr,
      history: o.status_history
    }
  }
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
  
  // New order flow: pending_vendor_acceptance → confirmed → packed → shipped → out_for_delivery → delivered
  // Legacy flow preserved for old orders: pending → confirmed → vendor_assigned → vendor_accepted → ...
  const NEW_STEPS = ['pending_vendor_acceptance', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered']
  const LEGACY_STEPS = ['pending', 'confirmed', 'vendor_assigned', 'vendor_accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered']
  
  const currentKey = statusStr.toLowerCase().trim().replace(/ /g, '_')
  const newIdx = NEW_STEPS.indexOf(currentKey)
  const legacyIdx = LEGACY_STEPS.indexOf(currentKey)
  
  // Determine which flow this order follows
  const isNewFlow = newIdx !== -1 || currentKey === 'vendor_rejected' || currentKey === 'cancelled'
  const steps = isNewFlow ? NEW_STEPS : LEGACY_STEPS
  const activeIdx = isNewFlow ? newIdx : legacyIdx
  
  if (currentKey === 'vendor_rejected') {
    statusHistory = [
      { status: 'pending_vendor_acceptance', timestamp: pAt, note: 'Order placed — Awaiting zonal admin acceptance' },
      { status: currentKey, timestamp: uAt, note: 'Zonal admin declined the order. Needs reassignment by owner.' }
    ]
  } else if (currentKey === 'rejected') {
    const reasonNote = o.rejection_reason ? `Reason: ${o.rejection_reason}` : 'Order was rejected'
    statusHistory = [
      { status: 'pending_vendor_acceptance', timestamp: pAt, note: 'Order placed — Awaiting zonal admin acceptance' },
      { status: currentKey, timestamp: uAt, note: `Order Rejected. ${reasonNote}` }
    ]
  } else if (currentKey === 'cancelled' || currentKey === 'returned') {
    statusHistory = [
      { status: 'pending_vendor_acceptance', timestamp: pAt, note: 'Order placed — Awaiting zonal admin acceptance' },
      { status: currentKey, timestamp: uAt, note: `Order was ${currentKey}` }
    ]
  } else if (activeIdx === -1) {
    statusHistory = [{ status: currentKey, timestamp: uAt, note: `Order status is ${currentKey}` }]
  } else {
    statusHistory = []
    for (let i = 0; i <= activeIdx; i++) {
      const stepKey = steps[i]
      let ts = pAt
      let note = ''
      
      if (i === activeIdx) {
        ts = uAt
      } else if (i > 0) {
        const pTime = new Date(pAt).getTime()
        const uTime = new Date(uAt).getTime()
        ts = new Date(pTime + (uTime - pTime) * (i / activeIdx)).toISOString()
      }
      
      if (stepKey === 'pending_vendor_acceptance') note = 'Order placed — Awaiting zonal admin acceptance'
      if (stepKey === 'confirmed') note = 'Zonal admin accepted — Order confirmed, processing'
      if (stepKey === 'packed') note = 'Order packed at warehouse'
      if (stepKey === 'shipped') note = 'Package dispatched to courier partner'
      if (stepKey === 'out_for_delivery') note = 'Courier partner is delivering today'
      if (stepKey === 'delivered') note = 'Delivered to recipient location'
      // Legacy notes for old flow
      if (stepKey === 'pending' && !isNewFlow) note = 'Order submitted — Pending Owner Approval'
      if (stepKey === 'vendor_assigned' && !isNewFlow) note = 'Zonal admin assigned'
      if (stepKey === 'vendor_accepted' && !isNewFlow) note = 'Zonal admin accepted the assignment'
      
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

  // Ensure categories exist and have proper min_order_value set
  const { data: existingCats } = await supabase.from('categories').select('id, slug')
  if (!existingCats || existingCats.length === 0) {
    const cats = [
      { name: 'Office Stationery', slug: 'office-stationery', description: 'Papers, files, pens, notebooks & printer supplies', image_url: '/category-stationery.jpg', icon: 'FileText', min_order_value: 2000 },
      { name: 'Housekeeping', slug: 'housekeeping', description: 'Cleaning chemicals, tissues, mops & sanitation supplies', image_url: '/category-housekeeping.jpg', icon: 'Sparkles', min_order_value: 5000 },
      { name: 'UPS Solutions', slug: 'ups-solutions', description: 'UPS systems, batteries & power backup accessories', image_url: '/category-ups.jpg', icon: 'BatteryCharging', min_order_value: null },
      { name: 'Grocery', slug: 'grocery', description: 'Daily groceries, pantry supplies & office kitchen essentials', image_url: '/category-grocery.jpg', icon: 'ShoppingBasket', min_order_value: null },
    ].map(c => ({ id: uuidv4(), ...c, created_at: now }))
    
    let { error } = await supabase.from('categories').insert(cats)
    if (error && (error.message.includes("column") || error.code === '42703')) {
      const fallbackCats = cats.map(c => {
        const copy = { ...c }
        delete copy.description
        delete copy.icon
        return copy
      })
      await supabase.from('categories').insert(fallbackCats)
    }
  } else {
    // Ensure min_order_value values are synced on existing categories
    await supabase.from('categories').update({ min_order_value: 5000 }).eq('slug', 'housekeeping')
    await supabase.from('categories').update({ min_order_value: 2000 }).eq('slug', 'office-stationery')
    await supabase.from('categories').update({ min_order_value: null }).eq('slug', 'ups-solutions')
    
    // Ensure Grocery category exists
    const hasGrocery = existingCats.some(c => c.slug === 'grocery')
    if (!hasGrocery) {
      const groceryDoc = {
        id: uuidv4(),
        name: 'Grocery',
        slug: 'grocery',
        description: 'Daily groceries, pantry supplies & office kitchen essentials',
        image_url: '/category-grocery.jpg',
        icon: 'ShoppingBasket',
        min_order_value: null,
        created_at: now
      }
      let { error } = await supabase.from('categories').insert(groceryDoc)
      if (error && (error.message.includes("column") || error.code === '42703')) {
        const fallbackGrocery = { ...groceryDoc }
        delete fallbackGrocery.description
        delete fallbackGrocery.icon
        await supabase.from('categories').insert(fallbackGrocery)
      }
    }
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
    marquee_messages: ['🚚 Free Pan-India Delivery on Bulk Orders'],
    supplier_state: 'Maharashtra', updated_at: now,
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

  if (p[0] === 'test-excel' && method === 'GET') {
    const { generateFullReport } = await import('@/lib/report-generator')
    const dummyOrders = [
      {
        id: 'ord_1',
        order_number: 'AKTEST1001',
        status: 'delivered',
        total: 1500,
        subtotal: 1400,
        discount: 0,
        gst_amount: 100,
        shipping_fee: 0,
        placed_at: new Date().toISOString(),
        vendor_name: 'Zonal Admin Pune',
        assigned_vendor_id: 'v_1',
        vendor_email: 'pune@ak.com',
        user_id: 'usr_1',
        user_email: 'customer@client.com',
        addresses: {
          full_name: 'Ayan Shaikh',
          business_name: 'Ayan Corp',
          phone: '9876543210',
          gst: '27AAAAA1111A1Z1',
          line1: '123 Main St',
          line2: 'Suite 4',
          city: 'Pune',
          district: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          country: 'India'
        },
        order_items: [
          {
            id: 'item_1',
            product_name_snapshot: 'Test Product 1',
            quantity: 2,
            price_snapshot: 700,
            products: {
              hsn_code: '84713010',
              gst_percent: 18,
              categories: {
                name: 'Electronics'
              }
            }
          }
        ]
      }
    ]
    const xlsxBuffer = generateFullReport(dummyOrders, { role: 'admin' })
    return new NextResponse(xlsxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="test_output.xlsx"',
        'Content-Length': String(xlsxBuffer.length)
      }
    })
  }

  // ── Client Error Logger ─────────────────────────────────────────────────────
  // POST /api/log-client-error  — logs browser/React crashes from any client
  // GET  /api/log-client-error  — admin-only: returns recent 50 errors
  if (p[0] === 'log-client-error') {
    if (method === 'POST') {
      try {
        const { message, stack, url: errorUrl, context, timestamp } = body
        const userRole = user?.role || 'unknown'
        await supabase.from('client_errors').insert({
          message: (message || 'Unknown error').slice(0, 2000),
          stack: (stack || '').slice(0, 5000),
          url: (errorUrl || '').slice(0, 500),
          context: (context || '').slice(0, 500),
          user_role: userRole,
          timestamp: timestamp || new Date().toISOString(),
          created_at: new Date().toISOString()
        })
      } catch (e) {
        // Intentionally silent — logging must NEVER cause another error
        console.warn('[log-client-error] Insert failed silently:', e?.message)
      }
      return json({ ok: true })
    }
    if (method === 'GET') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      try {
        const { data: errors, error: fetchErr } = await supabase
          .from('client_errors')
          .select('id, message, url, context, user_role, timestamp, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
        if (fetchErr) return err('Failed to fetch error logs: ' + fetchErr.message, 500)
        return json({ errors: errors || [] })
      } catch (e) {
        return err('Internal error: ' + e.message, 500)
      }
    }
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

  const body = ['POST','PUT','PATCH','DELETE'].includes(method) ? await req.json().catch(()=>({})) : {}

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
        email_confirm: true,
        user_metadata: { full_name: full_name, role: 'customer', plain_password: password }
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

      const token = sign({ id: newUuid, email: u.email, role: u.role, name: u.full_name, gst_number: u.gst_number || '' })
      return json({ token, user: { id: newUuid, email: u.email, full_name: u.full_name, role: u.role, phone: u.phone, gst_number: u.gst_number || null, company_name: u.company_name || null, address: u.address || null, city: u.city || null, state: u.state || null, pincode: u.pincode || null } })
    }
    if (p[1] === 'login' && method === 'POST') {
      const { email, password } = body
      const { data: u } = await supabase.from('users').select('*').eq('email', email).eq('password', hashPw(password)).maybeSingle()
      if (!u) return err('Invalid credentials', 401)

      // Check if vendor account is disabled
      if (u.role === 'vendor') {
        const { data: vendorRecord } = await supabase.from('vendors').select('id').eq('user_id', u.id).maybeSingle()
        if (vendorRecord) {
          const { data: disabledStore } = await supabase.from('settings').select('marquee_messages').eq('id', 'disabled_vendors').maybeSingle()
          const disabledList = disabledStore?.marquee_messages || []
          if (disabledList.includes(vendorRecord.id)) {
            return err('Your account has been disabled — contact AK Enterprises', 403)
          }
        }
      }

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

      console.log('[DEBUG LOGIN] token payload being signed:', JSON.stringify({ id: u.id, email: u.email, role: u.role, name: u.full_name, gst_number: u.gst_number || '' }))
      const token = sign({ id: u.id, email: u.email, role: u.role, name: u.full_name, gst_number: u.gst_number || '' })
      return json({ token, user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, phone: u.phone, gst_number: u.gst_number || null, company_name: u.company_name || null, address: u.address || null, city: u.city || null, state: u.state || null, pincode: u.pincode || null } })
    }

    if (p[1] === 'me' && method === 'GET') {
      if (!user) return err('Unauthorized', 401)
      const { data: u, error: uErr } = await supabase.from('users').select('id, email, full_name, phone, role, gst_number, company_name, address, city, state, pincode').eq('id', user.id).maybeSingle()
      if (uErr) {
        console.error('[ME error]:', uErr.message)
        return err('Unable to load user profile. Please contact the administrator if this problem persists.', 500)
      }
      console.log('[DEBUG ME] decoded token payload:', JSON.stringify({ ...user, password: undefined }), '| DB role lookup ->', JSON.stringify(u))
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
    if (user.role === 'vendor') return json({ has_access: false, is_vendor: true, message: "Zonal Admin accounts do not have catalog access." })
    
    const visibleMap = await getCustomerVisiblePricingMap(user.id)
    return json({ has_access: visibleMap.size > 0, visible_count: visibleMap.size })
  }

  if (p[0] === 'categories') {
    if (method === 'GET') {
      const { data: cats } = await supabase.from('categories').select('*').order('name', { ascending: true })
      return json(cats || [], 200)
    }
    if (method === 'POST') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { name, min_order_value, description } = body
      if (!name) return err('Name is required')
      const id = uuidv4()
      const slug = body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      const doc = { 
        id, 
        name, 
        slug, 
        min_order_value: min_order_value !== undefined ? (min_order_value === '' ? null : Number(min_order_value)) : null, 
        description: description || '', 
        image_url: body.image_url || null,
        icon: body.icon || 'Package',
        created_at: new Date().toISOString() 
      }
      
      let { error } = await supabase.from('categories').insert(doc)
      if (error && (error.message.includes("column \"description\"") || error.message.includes("description") || error.code === '42703')) {
        const fallbackDoc = { ...doc }
        delete fallbackDoc.description
        delete fallbackDoc.icon
        const { error: retryErr } = await supabase.from('categories').insert(fallbackDoc)
        error = retryErr
      }
      if (error) return err(error.message, 500)
      return json(doc)
    }
    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { name, slug, min_order_value, description } = body
      const updateData = {}
      if (name) updateData.name = name
      if (slug) updateData.slug = slug
      updateData.min_order_value = min_order_value !== undefined ? (min_order_value === '' ? null : Number(min_order_value)) : null
      if (description !== undefined) updateData.description = description
      
      let { error } = await supabase.from('categories').update(updateData).eq('id', p[1])
      if (error && (error.message.includes("column \"description\"") || error.message.includes("description") || error.code === '42703')) {
        const fallbackUpdate = { ...updateData }
        delete fallbackUpdate.description
        const { error: retryErr } = await supabase.from('categories').update(fallbackUpdate).eq('id', p[1])
        error = retryErr
      }
      if (error) return err(error.message, 500)
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { data: prods } = await supabase.from('products').select('id').eq('category_id', p[1]).limit(1)
      if (prods && prods.length > 0) {
        return err('Cannot delete category: products are currently assigned to it. Re-assign or delete those products first.', 400)
      }
      const { error } = await supabase.from('categories').delete().eq('id', p[1])
      if (error) return err(error.message, 500)
      return json({ ok: true })
    }
  }

  if (p[0] === 'products') {
    if (method === 'GET' && !p[1]) {
      if (!user) {
        return json({ catalog_locked: true, products: [], message: "Catalog browsing is restricted. Please log in to view products and prices." }, 401)
      }
      if (user.role === 'vendor') {
        return json({ catalog_locked: true, products: [], message: "Zonal Admin accounts do not have catalog access." }, 403)
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

      let query = supabase.from('products').select('*, product_images(image_url)')
      if (user.role !== 'admin') {
        query = query.eq('is_active', true)
      }
      
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
      if (rating) query = query.gte('rating_avg', +rating)
      
      if (sort === 'price-asc') query = query.order('price', { ascending: true })
      else if (sort === 'price-desc') query = query.order('price', { ascending: false })
      else if (sort === 'popular') query = query.order('rating_count', { ascending: false })
      else query = query.order('created_at', { ascending: false })
      
      const { data: list } = await query
       let listMapped = (list || []).map(p => {
        const withMeta = extractMetadata(p)
        const customPrice = customerPricingMap ? customerPricingMap.get(p.id) : withMeta.price
        const rawImgs = (withMeta.product_images || []).map(img => img.image_url).filter(Boolean)
        let finalImgs = []
        if (rawImgs.length > 0) finalImgs = rawImgs
        else if (withMeta.images && withMeta.images.length > 0) finalImgs = withMeta.images.filter(Boolean)
        else if (withMeta.image_url) finalImgs = [withMeta.image_url]
        else finalImgs = ['/placeholder.png']

        return {
          ...withMeta,
          price: customPrice !== undefined ? customPrice : withMeta.price,
          original_default_price: user.role === 'admin' ? withMeta.price : undefined,
          images: finalImgs,
          image_url: finalImgs[0]
        }
      })
      if (brand) {
        listMapped = listMapped.filter(p => (p.brand || '').toLowerCase() === brand.toLowerCase())
      }
      return json({ catalog_locked: false, products: listMapped }, 200)
    }
    if (method === 'GET' && p[1]) {
      if (!user) return err('Unauthorized', 401)
      if (user.role === 'vendor') return err('Forbidden for zonal admins', 403)

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
      
      let relatedMapped = (related || []).map(p => {
        const rWithMeta = extractMetadata(p)
        return {
          ...rWithMeta,
          images: rWithMeta.product_images?.map(img => img.image_url) || []
        }
      })

      if (user.role === 'customer') {
        const visibleMap = await getCustomerVisiblePricingMap(user.id)
        relatedMapped = relatedMapped
          .filter(r => visibleMap.has(r.id))
          .map(r => ({ ...r, price: visibleMap.get(r.id) }))
      }

      const prodWithMeta = extractMetadata(prod)
      const prodMapped = {
        ...prodWithMeta,
        images: prodWithMeta.product_images?.map(img => img.image_url) || []
      }
      return json({ ...prodMapped, category: cat, related: relatedMapped, reviews: reviews || [] })
    }
    if (method === 'POST') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const now = new Date().toISOString()
      const pId = uuidv4()
      
      const calculatedMrp = body.mrp && Number(body.mrp) >= Number(body.price) ? Number(body.mrp) : Number(body.price)
      const discountPercent = calculatedMrp > 0 ? Math.max(0, Math.round((1 - Number(body.price) / calculatedMrp) * 100)) : 0

      const doc = { 
        id: pId, 
        name: body.name, 
        slug: (body.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'), 
        description: injectMetadata(body), 
        price: body.price, 
        mrp: calculatedMrp, 
        discount_percent: discountPercent, 
        category_id: body.category_id || null, 
        stock_quantity: body.stock_quantity, 
        sku: body.sku || 'AK-' + Math.floor(Math.random()*90000+10000), 
        is_active: body.is_active!==false, 
        hsn_code: body.hsn_code || null,
        unit: body.unit || 'NOS',
        created_at: now, 
        updated_at: now, 
        rating_avg: 0, 
        rating_count: 0 
      }
      const { error: insErr } = await supabase.from('products').insert(doc)
      if (insErr) {
        console.error('[POST /api/products Error]:', insErr)
        return err(insErr.message || 'Failed to insert product into database', 500)
      }
      if (body.images?.length > 0) {
        const imgDocs = body.images.map((url, idx) => ({ id: uuidv4(), product_id: pId, image_url: url, sort_order: idx, created_at: now }))
        const { error: imgErr } = await supabase.from('product_images').insert(imgDocs)
        if (imgErr) console.error('[POST /api/products Image Insert Error]:', imgErr)
      }
      return json({ ...extractMetadata(doc), images: body.images || [] })
    }
    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const now = new Date().toISOString()
      
      // Load existing product first to implement partial save behavior
      const { data: existing } = await supabase.from('products').select('*').eq('id', p[1]).maybeSingle()
      if (!existing) return err('Product not found', 404)
      const existingWithMeta = extractMetadata(existing)

      // Merge only the provided body fields with existing values
      const merged = { ...existingWithMeta, ...body }
      
      const calculatedMrp = merged.mrp && Number(merged.mrp) >= Number(merged.price) ? Number(merged.mrp) : Number(merged.price)
      const discountPercent = calculatedMrp > 0 ? Math.max(0, Math.round((1 - Number(merged.price) / calculatedMrp) * 100)) : 0

      const upd = { 
        name: merged.name, 
        slug: merged.slug || (merged.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'), 
        description: injectMetadata(merged), 
        price: merged.price, 
        mrp: calculatedMrp, 
        discount_percent: discountPercent,
        category_id: merged.category_id || null, 
        stock_quantity: merged.stock_quantity, 
        sku: merged.sku, 
        is_active: merged.is_active, 
        hsn_code: merged.hsn_code,
        unit: merged.unit || 'NOS',
        updated_at: now 
      }
      // Remove undefined keys so we don't overwrite with undefined
      Object.keys(upd).forEach(k => upd[k] === undefined && delete upd[k])
      
      const { error: updErr } = await supabase.from('products').update(upd).eq('id', p[1])
      if (updErr) {
        console.error('[PUT /api/products Error]:', updErr)
        return err(updErr.message || 'Failed to update product in database', 500)
      }
      if (body.images) {
        await supabase.from('product_images').delete().eq('product_id', p[1])
        if (body.images.length > 0) {
          const imgDocs = body.images.map((url, idx) => ({ id: uuidv4(), product_id: p[1], image_url: url, sort_order: idx, created_at: now }))
          await supabase.from('product_images').insert(imgDocs)
        }
      }
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[1] && p[1] !== 'bulk') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const productId = p[1]
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, order_number, order_items(product_id)')
        .not('status', 'in', '("delivered","cancelled","rejected","admin_rejected","vendor_rejected")')

      const activeProductIds = new Set()
      if (Array.isArray(activeOrders)) {
        activeOrders.forEach(o => {
          if (Array.isArray(o.order_items)) {
            o.order_items.forEach(it => {
              if (it.product_id) activeProductIds.add(it.product_id)
            })
          }
        })
      }

      if (activeProductIds.has(productId)) {
        return err('Cannot delete product: it is part of an active order that is currently being processed.', 400)
      }

      const { error: delErr } = await supabase.from('products').delete().eq('id', productId)
      if (delErr) return err(delErr.message, 500)
      return json({ ok: true })
    }
    if (method === 'DELETE' && p[1] === 'bulk') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const ids = body.ids || []
      if (!Array.isArray(ids) || ids.length === 0) return err('IDs array required', 400)

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, order_number, order_items(product_id, product_name_snapshot)')
        .not('status', 'in', '("delivered","cancelled","rejected","admin_rejected","vendor_rejected")')

      const activeProductIds = new Set()
      const activeProductIdToName = new Map()
      if (Array.isArray(activeOrders)) {
        activeOrders.forEach(o => {
          if (Array.isArray(o.order_items)) {
            o.order_items.forEach(it => {
              if (it.product_id) {
                activeProductIds.add(it.product_id)
                activeProductIdToName.set(it.product_id, it.product_name_snapshot || 'Product')
              }
            })
          }
        })
      }

      const toDelete = []
      const skipped = []

      ids.forEach(id => {
        if (activeProductIds.has(id)) {
          skipped.push(activeProductIdToName.get(id) || id)
        } else {
          toDelete.push(id)
        }
      })

      if (toDelete.length > 0) {
        await supabase.from('product_images').delete().in('product_id', toDelete)
        await supabase.from('products').delete().in('id', toDelete)
      }

      return json({ ok: true, deletedCount: toDelete.length, skipped })
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
    const { full_name, phone, email, gst_number, company_name, address, city, state, pincode } = body

    // Validation
    if (!company_name || !company_name.trim()) return err('Company Name is required', 400)
    if (!email || !email.trim()) return err('Email is required', 400)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) return err('Please enter a valid email address', 400)
    
    if (pincode && pincode.trim()) {
      if (!/^\d{6}$/.test(pincode.trim())) {
        return err('Pincode must be exactly 6 digits', 400)
      }
    }
    
    if (gst_number && gst_number.trim()) {
      const gst = gst_number.trim().toUpperCase()
      if (gst.length !== 15) {
        return err('GST Number must be exactly 15 characters', 400)
      }
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      if (!gstRegex.test(gst)) {
        return err('Invalid GST Number format (e.g. 27AAAAA1111A1Z1)', 400)
      }
    }
    
    const { data: emailExists, error: emailCheckErr } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).neq('id', user.id).maybeSingle()
    if (emailCheckErr) {
      console.error('Email check database error:', emailCheckErr)
      return err('Unable to save profile. Please contact the administrator if this problem persists.', 500)
    }
    if (emailExists) return err('Email is already in use by another account', 409)

    const userUpdatePayload = {
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      gst_number: gst_number ? gst_number.trim().toUpperCase() : null,
      company_name: company_name ? company_name.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      pincode: pincode ? pincode.trim() : null
    }

    const { error: uErr } = await supabase.from('users').update(userUpdatePayload).eq('id', user.id)
    if (uErr) {
      console.error('User update database error:', uErr)
      return err('Unable to save profile. Please contact the administrator if this problem persists.', 500)
    }
    
    const { error: pErr } = await supabase.from('profiles').update({ full_name: full_name.trim(), phone: phone ? phone.trim() : '' }).eq('id', user.id)
    if (pErr) console.error('Profile update warning (profiles):', pErr.message)

    const updatedUser = {
      id: user.id,
      email: userUpdatePayload.email,
      full_name: userUpdatePayload.full_name,
      role: user.role,
      phone: userUpdatePayload.phone,
      gst_number: userUpdatePayload.gst_number,
      company_name: userUpdatePayload.company_name,
      address: userUpdatePayload.address,
      city: userUpdatePayload.city,
      state: userUpdatePayload.state,
      pincode: userUpdatePayload.pincode
    }

    const token = sign({
      id: user.id,
      email: updatedUser.email,
      role: user.role,
      name: updatedUser.full_name,
      gst_number: updatedUser.gst_number || ''
    })
    return json({ token, user: updatedUser })
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
      const { full_name, phone, line1, line2, city, state, pincode, is_default, gst } = body
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
        gst: gst || null,
        created_at: now,
        updated_at: now
      }
      
      const { error: insErr } = await supabase.from('addresses').insert(newAddr)
      if (insErr) return err('Failed to insert address: ' + insErr.message, 500)
      return json(newAddr)
    }
    
    if (method === 'PUT' && p[1]) {
      const { full_name, phone, line1, line2, city, state, pincode, is_default, gst } = body
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
        gst: gst || null,
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
    // GET /api/orders/:orderId/invoice-pdf
    if (p[1] && p[2] === 'invoice-pdf' && method === 'GET') {
      if (!user) return err('Unauthorized', 401)
      try {
        const orderId = p[1]
        const { data: o, error: getErr } = await supabase
          .from('orders')
          .select('*, addresses(*), order_items(*, products(*))')
          .eq('id', orderId)
          .maybeSingle()
        if (getErr || !o) return err('Order not found', 404)
        if (user.role !== 'admin' && user.role !== 'vendor' && o.user_id !== user.id) return err('Forbidden', 403)

        // Fetch customer profile details
        const { data: customer } = await supabase
          .from('users')
          .select('company_name, gst_number, business_name, full_name, phone')
          .eq('id', o.user_id)
          .maybeSingle()
        o.customer_profile = customer || {}

        const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()

        // Validate Data before generation
        const validation = validateInvoiceData(o, settings || {}, false)
        if (!validation.valid) {
          // Log failure silently if table doesn't exist
          try {
            await supabase.from('invoice_generation_logs').insert({
              order_id: orderId,
              document_type: 'invoice',
              status: 'failure',
              error_message: validation.error
            })
          } catch (logErr) {}
          return err(validation.error, 400)
        }

        try {
          const pdfBuffer = await generateInvoicePDF(o, settings || {})
          
          // Log success
          try {
            await supabase.from('invoice_generation_logs').insert({
              order_id: orderId,
              document_type: 'invoice',
              status: 'success'
            })
          } catch (logErr) {}
          
          return new NextResponse(Buffer.from(pdfBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="invoice-${o.order_number}.pdf"`
            }
          })
        } catch (genErr) {
          try {
            await supabase.from('invoice_generation_logs').insert({
              order_id: orderId,
              document_type: 'invoice',
              status: 'failure',
              error_message: 'Generation failed: ' + genErr.message
            })
          } catch (logErr) {}
          throw genErr
        }
      } catch (e) {
        console.error('[GET Invoice PDF Error]:', e)
        return err('Failed to generate invoice PDF: ' + e.message, 500)
      }
    }

    // GET /api/orders/:orderId/challan-pdf
    // Accessible to all roles: admin, vendor, and customer (for their own orders)
    if (p[1] && p[2] === 'challan-pdf' && method === 'GET') {
      if (!user) return err('Unauthorized', 401)
      try {
        const orderId = p[1]
        const { data: o, error: getErr } = await supabase
          .from('orders')
          .select('*, addresses(*), order_items(*, products(*))')
          .eq('id', orderId)
          .maybeSingle()
        if (getErr || !o) return err('Order not found', 404)
        // Allow admin, vendor, or the customer who placed the order
        if (user.role !== 'admin' && user.role !== 'vendor' && o.user_id !== user.id) {
          return err('Forbidden', 403)
        }

        // Fetch customer profile details
        const { data: customer } = await supabase
          .from('users')
          .select('company_name, gst_number, business_name, full_name, phone')
          .eq('id', o.user_id)
          .maybeSingle()
        o.customer_profile = customer || {}

        const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()

        // Validate Data before generation
        const validation = validateInvoiceData(o, settings || {}, true)
        if (!validation.valid) {
          try {
            await supabase.from('invoice_generation_logs').insert({
              order_id: orderId,
              document_type: 'challan',
              status: 'failure',
              error_message: validation.error
            })
          } catch (logErr) {}
          return err(validation.error, 400)
        }

        try {
          const pdfBuffer = await generateChallanPDF(o, settings || {})
          
          try {
            await supabase.from('invoice_generation_logs').insert({
              order_id: orderId,
              document_type: 'challan',
              status: 'success'
            })
          } catch (logErr) {}
          
          return new NextResponse(Buffer.from(pdfBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="delivery-challan-${o.order_number}.pdf"`
            }
          })
        } catch (genErr) {
          try {
            await supabase.from('invoice_generation_logs').insert({
              order_id: orderId,
              document_type: 'challan',
              status: 'failure',
              error_message: 'Generation failed: ' + genErr.message
            })
          } catch (logErr) {}
          throw genErr
        }
      } catch (e) {
        console.error('[GET Challan PDF Error]:', e)
        return err('Failed to generate challan PDF: ' + e.message, 500)
      }
    }

    if (method === 'GET' && !p[1]) {
      if (!user) return err('Unauthorized', 401)
      
      let query = supabase.from('orders').select('*, addresses(*), order_items(*, products(*, product_images(image_url)))', { count: 'exact' })
      if (user.role !== 'admin') {
        query = query.eq('user_id', user.id)
      }

      // 1. Pagination parameters (defaults: limit 50, page 1)
      const limitVal = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)))
      const pageVal = Math.max(1, Number(url.searchParams.get('page') || 1))
      const from = (pageVal - 1) * limitVal
      const to = from + limitVal - 1

      // 2. Date Filtering (IST-aware — Default to Last 12 Months for admin)
      const range = url.searchParams.get('range') || 'last-12-months'
      const startDateParam = url.searchParams.get('startDate')
      const endDateParam = url.searchParams.get('endDate')

      // Reusable IST-aware range helper (lib/date-helpers.js) — guarantees the
      // "Today"/"Yesterday" boundaries are aligned to the Indian business day.
      const bounds = getDateRange(range, startDateParam, endDateParam)
      const filterStart = bounds.start
      const filterEnd = bounds.end

      if (filterStart) {
        query = query.gte('placed_at', filterStart.toISOString())
      }
      if (filterEnd) {
        query = query.lte('placed_at', filterEnd.toISOString())
      }

      // 3. Status Filter (supports 'pending_approval' as a virtual status for both pending admin approval types)
      const status = url.searchParams.get('status')
      if (status && status !== 'all') {
        const statusLower = status.toLowerCase().trim()
        if (statusLower === 'pending_approval') {
          query = query.in('status', ['vendor_accepted_pending_admin_approval', 'pending_admin_approval', 'vendor_accepted'])
        } else {
          query = query.eq('status', statusLower)
        }
      }

      // Apply pagination bounds in query
      query = query.range(from, to).order('placed_at', { ascending: false })

      // Fetch
      const { data: dbOrders, count, error: getErr } = await query
      if (getErr) return err('Failed to fetch orders: ' + getErr.message, 500)

      const mapped = (dbOrders || []).map(o => {
        const { status: statusStr, history: statusHistory } = buildStatusHistory(o)
        // Filter out error-string vendor_name values (legacy data)
        const vendorDisplay = (o.vendor_name && !o.vendor_name.startsWith('No zonal admin assigned')) ? o.vendor_name : null
        return {
          ...o,
          status: statusStr,
          status_history: statusHistory,
          vendor_name: vendorDisplay,
          address: o.addresses,
          zoho_invoice_status: o.zoho_invoice_status || (o.zoho_invoice_id ? 'synced' : 'pending'),
          items: (o.order_items || []).map(it => ({
            ...it,
            image: it.products?.product_images?.[0]?.image_url || '/placeholder.png'
          }))
        }
      })

      // 4. Text Search (Server-side text matching since order relationships are complex)
      let filtered = mapped
      const search = url.searchParams.get('search')
      if (search) {
        const q = search.toLowerCase().trim()
        filtered = mapped.filter(o => {
          const matchOrderNumber = String(o.order_number || '').toLowerCase().includes(q)
          const matchInvoiceNumber = `inv-${o.order_number}`.toLowerCase().includes(q)
          const matchCustomerName = String(o.address?.full_name || '').toLowerCase().includes(q)
          const matchVendorName = String(o.vendor_name || '').toLowerCase().includes(q)
          const matchPhone = String(o.address?.phone || '').toLowerCase().includes(q)
          const matchEmail = String(o.user_email || '').toLowerCase().includes(q)
          const matchProductName = (o.order_items || []).some(it => String(it.product_name_snapshot || '').toLowerCase().includes(q))
          return matchOrderNumber || matchInvoiceNumber || matchCustomerName || matchVendorName || matchPhone || matchEmail || matchProductName
        })
      }

      // 5. Aggregated Summary — computed over the FULL filtered set (range +
      //    status, ignoring pagination/search) so the KPI cards always match
      //    the selected "Time Period" + "Fulfillment Status" filters.
      let summaryQuery = supabase.from('orders').select('total, status')
      if (user.role !== 'admin') {
        summaryQuery = summaryQuery.eq('user_id', user.id)
      }
      if (filterStart) summaryQuery = summaryQuery.gte('placed_at', filterStart.toISOString())
      if (filterEnd) summaryQuery = summaryQuery.lte('placed_at', filterEnd.toISOString())
      if (status && status !== 'all') summaryQuery = summaryQuery.eq('status', status.toLowerCase().trim())

      let summary = { revenue: 0, avgOrderValue: 0, delivered: 0, cancelled: 0, count: 0 }
      try {
        const { data: summaryOrders, error: summaryErr } = await summaryQuery
        const list = summaryErr ? [] : (summaryOrders || [])
        let delivered = 0
        let cancelled = 0
        let totalRevenue = 0
        for (const o of list) {
          const grandTotal = Number(o.total || 0)
          if (o.status === 'delivered') {
            delivered++
            totalRevenue += grandTotal
          } else if (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'vendor_rejected') {
            cancelled++
          } else {
            totalRevenue += grandTotal
          }
        }
        summary = {
          revenue: Math.round(totalRevenue * 100) / 100,
          avgOrderValue: list.length > 0 ? Math.round((totalRevenue / list.length) * 100) / 100 : 0,
          delivered,
          cancelled,
          count: list.length
        }
      } catch (summaryCatchErr) {
        console.warn('[Orders Summary Failed]:', summaryCatchErr?.message)
      }

      return json({
        orders: filtered,
        totalCount: count || filtered.length,
        limit: limitVal,
        page: pageVal,
        totalPages: Math.ceil((count || filtered.length) / limitVal),
        summary
      })
    }
    
    if (method === 'GET' && p[1]) {
      if (!user) return err('Unauthorized', 401)
      try {
        const { data: o, error: getErr } = await supabase
          .from('orders')
          .select('*, addresses(*), order_items(*, products(*, product_images(image_url)))')
          .eq('id', p[1])
          .maybeSingle()
        if (getErr) return err('Failed to fetch order details: ' + getErr.message, 500)
        if (!o) return err('Not found', 404)
        if (user.role !== 'admin' && o.user_id !== user.id) return err('Forbidden', 403)

        // Fetch user email from users table (not stored on order directly)
        let userEmail = o.user_email || null
        if (!userEmail && o.user_id) {
          const { data: orderUser } = await supabase.from('users').select('email, gst_number').eq('id', o.user_id).maybeSingle()
          userEmail = orderUser?.email || null
          // Backfill gst_number from user if address doesn't have it
          // addresses join returns array — resolve to first element safely
          const addrObj = Array.isArray(o.addresses) ? o.addresses[0] : o.addresses
          if (!addrObj?.gst && orderUser?.gst_number) {
            if (addrObj) addrObj.gst = orderUser.gst_number
          }
        }
        
        const { status: statusStr, history: statusHistory } = buildStatusHistory(o)
        
        // Safely resolve addresses array → single object
        // Supabase join returns addresses(*) as an array even for single rows
        const resolvedAddress = Array.isArray(o.addresses)
          ? (o.addresses[0] || null)
          : (o.addresses || null)


        const orderMapped = {
          ...o,
          status: statusStr,
          status_history: statusHistory,
          user_email: userEmail,
          address: resolvedAddress,   // Always a plain object or null — never an array
          zoho_invoice_status: o.zoho_invoice_status || (o.zoho_invoice_id ? 'synced' : 'pending'),
          items: (o.order_items || []).map(it => ({
            ...it,
            image: it.products?.product_images?.[0]?.image_url || '/placeholder.png'
          }))
        }
        return json(orderMapped)
      } catch (e) {
        console.error('[GET Single Order Unexpected Error]:', e)
        return NextResponse.json({ error: 'Internal Server Error: ' + e.message }, { status: 500 })
      }
    }
    
    if (method === 'POST') {
      if (!user) return err('Unauthorized', 401)
      const { items, address, payment_method } = body
      if (!items?.length || !address) return err('Invalid order request', 400)
      
      // 1. Validate Category Minimum Order Values (server-side enforcement)
      const DEFAULT_MINS = { 'housekeeping': 5000, 'office-stationery': 2000, 'ups-solutions': 0, 'grocery': 0 }
      const { data: allCats } = await supabase.from('categories').select('*')
      const catList = (allCats && allCats.length > 0) ? allCats : [
        { id: 'hk', name: 'Housekeeping', slug: 'housekeeping', min_order_value: 5000 },
        { id: 'os', name: 'Office Stationery', slug: 'office-stationery', min_order_value: 2000 },
        { id: 'ups', name: 'UPS Solutions', slug: 'ups-solutions', min_order_value: 0 },
        { id: 'grocery', name: 'Grocery', slug: 'grocery', min_order_value: 0 }
      ]

      const catMap = Object.fromEntries(catList.map(c => [c.id, c]))
      const catMapBySlug = Object.fromEntries(catList.filter(c => c.slug).map(c => [c.slug.toLowerCase(), c]))

      const catTotals = {}
      for (const item of items) {
        let cat = null
        const prodRes = await supabase.from('products').select('id, category_id, name').eq('id', item.product_id || item.id).maybeSingle()
        const catId = prodRes?.data?.category_id || item.category_id

        if (catId && catMap[catId]) {
          cat = catMap[catId]
        } else if (item.category_slug && catMapBySlug[item.category_slug.toLowerCase()]) {
          cat = catMapBySlug[item.category_slug.toLowerCase()]
        }

        const pName = (prodRes?.data?.name || item.product_name_snapshot || item.name || '').toLowerCase()
        if (!cat) {
          if (pName.includes('pencil') || pName.includes('paper') || pName.includes('stationery') || pName.includes('pen') || pName.includes('apsara')) {
            cat = catMapBySlug['office-stationery']
          } else if (pName.includes('spoon') || pName.includes('freshener') || pName.includes('housekeeping')) {
            cat = catMapBySlug['housekeeping']
          }
        }

        if (!cat) continue

        const slugKey = (cat.slug || '').toLowerCase()
        const minVal = (cat.min_order_value !== undefined && cat.min_order_value !== null)
          ? Number(cat.min_order_value)
          : (DEFAULT_MINS[slugKey] ?? (pName.includes('pencil') || slugKey.includes('stationery') ? 2000 : slugKey.includes('housekeeping') ? 5000 : 0))

        if (!minVal || minVal <= 0) continue

        const catKey = cat.id || cat.slug || cat.name
        const itemTotal = (item.price_snapshot || item.price || 0) * Math.max(1, Number(item.quantity) || 1)
        catTotals[catKey] = (catTotals[catKey] || { name: cat.name, total: 0, min: minVal })
        catTotals[catKey].total += itemTotal
      }

      const violations = Object.values(catTotals).filter(c => c.total < c.min)
      if (violations.length > 0) {
        const msgs = violations.map(v => `${v.name}: ₹${v.total.toFixed(0)} items in cart — add ₹${(v.min - v.total).toFixed(0)} more to meet ₹${v.min} minimum`).join('; ')
        return err(`Category minimum order values not met — ${msgs}`, 400)
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
      
      // ── Persist GSTIN from checkout to users table ─────────────────────────
      // addresses table has no gst column — so if customer enters GSTIN
      // at checkout, we backfill it to users.gst_number so it's always
      // available when generating invoices / challans
      const checkoutGst = (address.gst || '').trim().toUpperCase()
      if (checkoutGst) {
        try {
          const { data: existingUser } = await supabase
            .from('users')
            .select('gst_number')
            .eq('id', user.id)
            .maybeSingle()
          // Only update if not already set (or if new one is being provided)
          if (!existingUser?.gst_number || existingUser.gst_number !== checkoutGst) {
            await supabase.from('users').update({ gst_number: checkoutGst }).eq('id', user.id)
          }
        } catch (gstErr) {
          // Non-fatal — continue with order creation even if GST save fails
          console.warn('[Order] Failed to backfill GST to user:', gstErr?.message)
        }
      }
      
      let needsNewAddress = !addrId || typeof addrId !== 'string' || addrId.length < 10

      if (addrId && !needsNewAddress) {
        // Fetch the existing address from DB to verify it matches perfectly
        const { data: dbAddr } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', addrId)
          .maybeSingle()
          
        if (!dbAddr || 
            dbAddr.full_name !== address.full_name ||
            dbAddr.phone !== address.phone ||
            dbAddr.line1 !== address.line1 ||
            (dbAddr.line2 || '') !== (address.line2 || '') ||
            dbAddr.city !== address.city ||
            dbAddr.state !== address.state ||
            dbAddr.pincode !== address.pincode) {
          needsNewAddress = true
          addrId = null
        }
      }

      if (needsNewAddress) {
        const { data: existing } = await supabase
          .from('addresses')
          .select('id')
          .eq('user_id', user.id)
          .eq('line1', address.line1)
          .eq('pincode', address.pincode)
          .eq('state', address.state)
          .eq('city', address.city)
          .eq('full_name', address.full_name)
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
            gst: address.gst || null,
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
        status: 'pending_vendor_acceptance', // Will be updated below if vendor assigned
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
      
      // Auto-assign vendor from customer's assigned vendor
      let assignedVendor = null
      try {
        const { data: customerVendor } = await supabase
          .from('users')
          .select('assigned_vendor_id')
          .eq('id', user.id)
          .maybeSingle()
        
        if (customerVendor?.assigned_vendor_id) {
          const { data: vendorRecord } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', customerVendor.assigned_vendor_id)
            .maybeSingle()
          
          if (vendorRecord) {
            assignedVendor = vendorRecord
          }
        }
      } catch (vendorErr) {
        console.warn('Vendor auto-assign lookup failed:', vendorErr.message)
      }
      
      // If NO vendor assigned: skip vendor step, go direct to Admin
      if (!assignedVendor) {
        const trackingData = {
          current: 'pending_admin_approval',
          history: [{ status: 'pending_admin_approval', timestamp: now, note: 'Order placed — No zonal admin assigned, awaiting Owner approval directly' }]
        }

        let { error: directErr } = await supabase.from('orders').update({
          status: 'pending_admin_approval',
          status_history: trackingData.history,
          updated_at: now
        }).eq('id', orderId)

        let finalStatus = 'pending_admin_approval'
        let finalHistory = trackingData.history

        if (directErr && directErr.code === '23514') {
          console.warn('[Constraint Error]: pending_admin_approval not allowed. Retrying with legacy pending status.')
          finalStatus = 'pending'
          finalHistory = [{ status: 'pending', timestamp: now, note: 'Order placed — No zonal admin assigned, awaiting Owner approval directly' }]
          await supabase.from('orders').update({
            status: 'pending',
            status_history: finalHistory,
            updated_at: now
          }).eq('id', orderId)
        }
        
        return json({
          ...orderDoc,
          status: finalStatus,
          status_history: finalHistory,
          address,
          items: itemDocs
        })
      }
      
      // Update order with vendor assignment
      if (assignedVendor) {
        const trackingData = {
          current: 'pending_vendor_acceptance',
          history: [{ status: 'pending_vendor_acceptance', timestamp: now, note: 'Order placed — Awaiting vendor acceptance' }]
        }

        await supabase.from('orders').update({
          assigned_vendor_id: assignedVendor.id,
          vendor_name: assignedVendor.name || '',
          vendor_email: assignedVendor.email || '',
          assigned_at: now,
          assigned_by: 'auto',
          status_history: trackingData.history,
          updated_at: now
        }).eq('id', orderId)
        
        // Notify vendor about new order
        try {
          await supabase.from('activity_logs').insert({
            id: uuidv4(),
            user_id: user.id,
            user_name: user.full_name || user.email,
            user_email: user.email,
            event_type: 'order',
            category: 'orders',
            title: `New order #${order_number} awaiting your acceptance`,
            description: `Order #${order_number} requires your review. Please accept or reject.`,
            metadata: { order_id: orderId, order_number, vendor_id: assignedVendor.id },
            created_at: now
          })
        } catch (actErr) {
          console.warn('Vendor notification insert failed:', actErr.message)
        }

        return json({
          ...orderDoc,
          status: 'pending_vendor_acceptance',
          status_history: trackingData.history,
          address,
          items: itemDocs
        })
      }
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
        if (newStatus === 'cancelled' && ['pending', 'pending_vendor_acceptance', 'pending_admin_approval', 'confirmed', 'vendor_accepted_pending_admin_approval'].includes(orderToUpdate.status)) {
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

      let finalStatus = targetStatus

      // ── ADMIN FINAL APPROVAL (from vendor_accepted_pending_admin_approval OR pending_admin_approval) ──
      if (targetStatus === 'admin_confirmed' || (targetStatus === 'confirmed' && ['vendor_accepted_pending_admin_approval', 'pending_admin_approval', 'vendor_accepted'].includes(orderToUpdate.status))) {
        if (!['vendor_accepted_pending_admin_approval', 'pending_admin_approval', 'pending', 'pending_vendor_acceptance', 'vendor_rejected', 'vendor_accepted'].includes(orderToUpdate.status)) {
          return err('Order has already been confirmed or processed.', 400)
        }
        finalStatus = 'confirmed'
        // Deduct stock & log stock movements
        for (const item of (orderToUpdate.order_items || [])) {
          const prod = item.products
          if (!prod) continue
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
      // ── ADMIN REJECT (from vendor_accepted_pending_admin_approval OR pending_admin_approval) ──
      } else if (targetStatus === 'admin_rejected') {
        if (!['vendor_accepted_pending_admin_approval', 'pending_admin_approval', 'pending', 'pending_vendor_acceptance', 'vendor_rejected', 'vendor_accepted'].includes(orderToUpdate.status)) {
          return err('Order has already been processed.', 400)
        }
        finalStatus = 'admin_rejected'
        updatePayload.rejection_reason = body.rejection_reason || 'Order rejected by Owner'
      // Handle Admin Accept Order (move from pending -> confirmed) — legacy path
      } else if (targetStatus === 'confirmed') {
        if (!['pending', 'pending_vendor_acceptance'].includes(orderToUpdate.status)) {
          return err('Order has already been processed.', 400)
        }
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

        // --- CUSTOMER-LEVEL VENDOR ASSIGNMENT LOGIC ---
        // Fetch order's placing user assigned_vendor_id
        const { data: orderUser } = await supabase.from('users').select('assigned_vendor_id').eq('id', orderToUpdate.user_id).maybeSingle()
        const assignedVendorId = orderUser?.assigned_vendor_id

        let chosenVendor = null
        if (assignedVendorId) {
          // Verify vendor is enabled (i.e. not in disabled list)
          const { data: disabledStore } = await supabase.from('settings').select('marquee_messages').eq('id', 'disabled_vendors').maybeSingle()
          const disabledList = disabledStore?.marquee_messages || []

          if (!disabledList.includes(assignedVendorId)) {
            const { data: vendorRecord } = await supabase.from('vendors').select('*').eq('id', assignedVendorId).maybeSingle()
            if (vendorRecord) {
              chosenVendor = vendorRecord
            }
          }
        }

        if (chosenVendor) {
          finalStatus = 'vendor_assigned' // Transition straight to vendor_assigned
          updatePayload.assigned_vendor_id = chosenVendor.id
          updatePayload.vendor_name = chosenVendor.name || ''
          updatePayload.vendor_email = chosenVendor.email || ''
          updatePayload.assigned_at = now
          updatePayload.assigned_by = 'Customer Zonal Admin System'
        } else {
          // If customer has no vendor assigned, or the assigned vendor is disabled
          // stay as 'confirmed' but do NOT store an error string as vendor_name
          finalStatus = 'confirmed'
          updatePayload.assigned_vendor_id = null
          updatePayload.vendor_name = null
          updatePayload.vendor_email = null
          updatePayload.assigned_at = null
          updatePayload.assigned_by = null
        }
      } else if (targetStatus === 'rejected') {
        if (!['pending', 'pending_admin_approval', 'vendor_accepted_pending_admin_approval', 'pending_vendor_acceptance'].includes(orderToUpdate.status)) {
          return err('Order has already been processed.', 400)
        }
        finalStatus = 'rejected'
        updatePayload.rejection_reason = body.rejection_reason || 'Order rejected by Admin'
      } else if (targetStatus) {
        finalStatus = targetStatus
      }

      if (finalStatus) {
        updatePayload.status = finalStatus
      }

      if (finalStatus && finalStatus !== orderToUpdate.status) {
        const history = Array.isArray(orderToUpdate.status_history) ? [...orderToUpdate.status_history] : []
        if (targetStatus === 'confirmed' && finalStatus === 'vendor_assigned') {
          history.push({
            status: 'confirmed',
            note: 'Order Accepted by Admin',
            timestamp: now
          })
        }
        history.push({
          status: finalStatus,
          note: finalStatus === 'vendor_assigned' ? `Zonal Admin Auto-Assigned: ${updatePayload.vendor_name}` : `Order status updated to ${finalStatus.toUpperCase()}`,
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
          return err('Zonal Admin not found for ID: ' + vendorId + '. Check that the zonal admin exists in the vendors table.', 404)
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
      const finalVendorId = updatePayload.assigned_vendor_id || body.assigned_vendor_id
      if (finalVendorId) {
        const vendorId = finalVendorId
        const ordNum = orderToUpdate.order_number || p[1]
        try {
          const { data: vendorRecord } = await supabase.from('vendors').select('user_id, name, email').eq('id', vendorId).maybeSingle()
          const notifications = []
          const notifNow = new Date().toISOString()

          // Owner notification
          notifications.push({
            id: uuidv4(), user_id: user.id,
            title: 'Zonal Admin Assigned Successfully',
            message: `Zonal Admin "${vendorRecord?.name || 'Partner'}" assigned to Order #${ordNum}.`,
            type: 'vendor_assigned', is_read: false, created_at: notifNow
          })

          // Zonal Admin notification
          if (vendorRecord?.user_id) {
            notifications.push({
              id: uuidv4(), user_id: vendorRecord.user_id,
              title: 'New Dispatch Assignment',
              message: `You have been assigned Order #${ordNum}. Open your Zonal Admin Portal to accept.`,
              type: 'vendor_assigned', is_read: false, created_at: notifNow,
              link: '/vendor'
            })
          }

          // Customer notification
          if (orderToUpdate.user_id) {
            notifications.push({
              id: uuidv4(), user_id: orderToUpdate.user_id,
              title: 'Zonal Admin Assigned',
              message: `Your order #${ordNum} has been assigned to a zonal admin and will be dispatched soon.`,
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
              user_name: user.full_name || 'Owner',
              user_email: user.email,
              event_type: 'order',
              title: 'Zonal Admin Assigned',
              description: `Zonal Admin "${vendorRecord?.name || 'Partner'}" assigned to Order #${ordNum}`,
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

      // Trigger Order Status Email via Edge Function
      const emailTargetStatus = updatePayload.status || body.status || targetStatus
      if (emailTargetStatus && ['confirmed', 'shipped', 'delivered'].includes(emailTargetStatus.toLowerCase())) {
        try {
          supabase.functions.invoke('send-order-email', {
            body: { orderId: p[1], type: emailTargetStatus.toLowerCase() }
          }).catch(invokeErr => {
            console.error('[Email Function Invoke Warning]:', invokeErr.message || invokeErr)
          })
        } catch (funcErr) {
          console.error('[Email Function Try Warning]:', funcErr.message || funcErr)
        }
      }

      // Send Order Confirmed Emails via Resend (Customer + Zonal Admin + Owner)
      if (emailTargetStatus && emailTargetStatus.toLowerCase() === 'confirmed') {
        // Non-blocking: fire-and-forget so order update is never blocked by email failures
        sendOrderConfirmedEmails(
          { ...orderToUpdate, ...updatePayload, id: p[1] },
          { supabaseClient: supabase }
        ).catch(emailErr => {
          console.error('[Resend Email Warning]: Order confirmation emails failed:', emailErr?.message || emailErr)
        })
      }

      // Send Order Delivered Emails via Resend (Customer + Zonal Admin + Owner)
      if (emailTargetStatus && emailTargetStatus.toLowerCase() === 'delivered') {
        sendOrderDeliveredEmails(
          { ...orderToUpdate, ...updatePayload, id: p[1] },
          { supabaseClient: supabase }
        ).catch(emailErr => {
          console.error('[Resend Email Warning]: Order delivery emails failed:', emailErr?.message || emailErr)
        })
      }



      return json({ ok: true, status: updatePayload.status || orderToUpdate.status })
    }
  }

  // ==================== COUPONS ====================


  // ==================== ZOHO PDF DOWNLOAD ENDPOINTS (FALLBACK) ====================
  // GET /api/zoho/invoice/:invoiceId  — generate and return PDF locally as fallback
  if (p[0] === 'zoho' && p[1] === 'invoice' && p[2] && method === 'GET') {
    if (!user || !['admin', 'customer', 'vendor'].includes(user.role)) return err('Unauthorized', 401)
    try {
      const supabase = db()
      const { data: o, error: getErr } = await supabase
        .from('orders')
        .select('*, addresses(*), order_items(*, products(*))')
        .eq('zoho_invoice_id', p[2])
        .maybeSingle()
        
      if (getErr || !o) {
        // Fallback: search by id just in case invoiceId matches order id
        const { data: o2 } = await supabase
          .from('orders')
          .select('*, addresses(*), order_items(*, products(*))')
          .eq('id', p[2])
          .maybeSingle()
        if (!o2) return err('Order not found', 404)

        // Fetch customer profile details
        const { data: customer } = await supabase
          .from('users')
          .select('company_name, gst_number, business_name, full_name, phone')
          .eq('id', o2.user_id)
          .maybeSingle()
        o2.customer_profile = customer || {}

        const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
        const pdfBuffer = await generateInvoicePDF(o2, settings || {})
        return new NextResponse(Buffer.from(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${o2.order_number}.pdf"`
          }
        })
      }
      if (user.role !== 'admin' && user.role !== 'vendor' && o.user_id !== user.id) return err('Forbidden', 403)

      // Fetch customer profile details
      const { data: customer } = await supabase
        .from('users')
        .select('company_name, gst_number, business_name, full_name, phone')
        .eq('id', o.user_id)
        .maybeSingle()
      o.customer_profile = customer || {}

      const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
      const pdfBuffer = await generateInvoicePDF(o, settings || {})

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${o.order_number}.pdf"`
        }
      })
    } catch (e) {
      return err('Failed to fetch invoice PDF: ' + e.message, 500)
    }
  }

  // GET /api/zoho/challan/:challanId  — generate and return delivery challan PDF locally as fallback
  if (p[0] === 'zoho' && p[1] === 'challan' && p[2] && method === 'GET') {
    if (!user) return err('Unauthorized', 401)
    if (!user || !['admin', 'vendor', 'customer'].includes(user.role)) return err('Forbidden', 403)
    try {
      const supabase = db()
      const { data: o, error: getErr } = await supabase
        .from('orders')
        .select('*, addresses(*), order_items(*, products(*))')
        .eq('zoho_challan_id', p[2])
        .maybeSingle()
        
      if (getErr || !o) {
        // Fallback: search by id just in case challanId matches order id
        const { data: o2 } = await supabase
          .from('orders')
          .select('*, addresses(*), order_items(*, products(*))')
          .eq('id', p[2])
          .maybeSingle()
        if (!o2) return err('Order not found', 404)

        // Fetch customer profile details
        const { data: customer } = await supabase
          .from('users')
          .select('company_name, gst_number, business_name, full_name, phone')
          .eq('id', o2.user_id)
          .maybeSingle()
        o2.customer_profile = customer || {}

        const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
        const pdfBuffer = await generateChallanPDF(o2, settings || {})
        return new NextResponse(Buffer.from(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="delivery-challan-${o2.order_number}.pdf"`
          }
        })
      }
      if (user.role !== 'admin' && user.role !== 'vendor' && o.user_id !== user.id) return err('Forbidden', 403)

      // Fetch customer profile details
      const { data: customer } = await supabase
        .from('users')
        .select('company_name, gst_number, business_name, full_name, phone')
        .eq('id', o.user_id)
        .maybeSingle()
      o.customer_profile = customer || {}

      const { data: settings } = await supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
      const pdfBuffer = await generateChallanPDF(o, settings || {})

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="delivery-challan-${o.order_number}.pdf"`
        }
      })
    } catch (e) {
      return err('Failed to fetch challan PDF: ' + e.message, 500)
    }
  }

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

  // ==================== PRODUCT REQUESTS ====================
  if (p[0] === 'product-requests') {
    if (!user) return err('Unauthorized', 401)
    const supabase = db()

    if (method === 'GET') {
      if (user.role !== 'admin') return err('Forbidden', 403)
      const { data, error } = await supabase
        .from('product_requests')
        .select('*, users(full_name, email, phone)')
        .order('created_at', { ascending: false })
      if (error) return err('Failed to fetch product requests: ' + error.message, 500)
      return json(data || [])
    }

    if (method === 'POST') {
      const { product_name, description, quantity_needed } = body
      if (!product_name) return err('Product name is required', 400)

      const { data, error } = await supabase
        .from('product_requests')
        .insert({
          customer_id: user.id,
          product_name,
          description,
          quantity_needed: quantity_needed || 1,
          status: 'pending'
        })
        .select()
        .single()

      if (error) return err('Failed to submit product request: ' + error.message, 500)
      return json(data)
    }

    if (method === 'PUT' && p[1]) {
      if (user.role !== 'admin') return err('Forbidden', 403)
      const { status } = body
      if (!status || !['pending', 'fulfilled'].includes(status)) {
        return err('Invalid status value', 400)
      }

      const { data, error } = await supabase
        .from('product_requests')
        .update({ status })
        .eq('id', p[1])
        .select()
        .single()

      if (error) return err('Failed to update product request: ' + error.message, 500)
      return json(data)
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
      if (!contact_person || !phone || !products_needed) return err('Missing required fields', 400)
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

    // Date range selector (defaults to Today in IST). All KPI values below are
    // computed within this range so the dashboard cards + chart stay in sync.
    const range = url.searchParams.get('range') || 'today'
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const bounds = getDateRange(range, startDateParam, endDateParam)
    const { start, end, days } = bounds

    const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
    const { data: orders } = await supabase.from('orders').select('*')
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true })

    const isInRange = o => {
      if (!start || !end) return true
      const t = new Date(o.placed_at || o.created_at).getTime()
      return !isNaN(t) && t >= start.getTime() && t <= end.getTime()
    }

    const rangeOrders = (orders || []).filter(isInRange)
    const revenue = rangeOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0)
    const pending = rangeOrders.filter(o => o.status === 'pending').length
    const { data: lowStock } = await supabase.from('products').select('name, stock_quantity').lt('stock_quantity', 20).limit(10)

    // "Orders Today" / "Revenue Today" — always computed against the actual
    // current IST day, regardless of the selected range, so these cards never
    // accidentally show all-time totals.
    const todayBounds = getDateRange('today')
    const isToday = o => {
      const t = new Date(o.placed_at || o.created_at).getTime()
      return !isNaN(t) && t >= todayBounds.start.getTime() && t <= todayBounds.end.getTime()
    }
    const todayOrders = (orders || []).filter(isToday)
    const ordersToday = todayOrders.length
    const revenueToday = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0)

    // Day-wise buckets (chart + breakdown table). For "all time" we fall back
    // to the last 120 IST days for the daily view so the response stays sane.
    let displayStart = start
    let displayEnd = end
    if (!displayStart || !displayEnd) {
      const todayStart = startOfISTDay(new Date())
      displayStart = new Date(todayStart.getTime() - 119 * DAY_MS)
      displayEnd = new Date(todayStart.getTime() + DAY_MS - 1)
    }

    const dayMap = {}
    for (const o of rangeOrders) {
      const key = orderISTDateKey(o.placed_at || o.created_at)
      if (!key) continue
      if (!dayMap[key]) dayMap[key] = { date: key, orders: 0, revenue: 0 }
      dayMap[key].orders++
      if (o.status !== 'cancelled') dayMap[key].revenue += (o.total || 0)
    }

    const byDay = {}
    const dailyBreakdown = []
    for (const { key } of listISTDays(displayStart, displayEnd)) {
      const row = dayMap[key] || { date: key, orders: 0, revenue: 0 }
      byDay[key] = row.orders
      dailyBreakdown.push({
        date: key,
        orders: row.orders,
        revenue: Math.round(row.revenue * 100) / 100,
        avgOrderValue: row.orders > 0 ? Math.round((row.revenue / row.orders) * 100) / 100 : 0
      })
    }
    dailyBreakdown.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    // Chart stays linked to the selected range but caps at 31 bars so very
    // long ranges don't produce an unreadable chart.
    const chartByDay = {}
    const chartKeys = Object.keys(byDay).slice(-Math.min(Math.max(days, 1), 31))
    for (const k of chartKeys) chartByDay[k] = byDay[k]

    return json({
      products: productsCount,
      orders: rangeOrders.length,
      users: usersCount,
      revenue,
      pending,
      lowStock: lowStock || [],
      byDay: chartByDay,
      dailyBreakdown,
      ordersToday,
      revenueToday,
      range,
      rangeDays: days
    })
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

  // GET /api/admin/generation-logs
  if (p[0] === 'admin' && p[1] === 'generation-logs' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const { data: logs, error } = await supabase
      .from('invoice_generation_logs')
      .select('*, orders(order_number)')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      return json([])
    }
    return json(logs || [])
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
      
      // Enhance requests list with DB metrics (products count, company details etc.)
      const enhancedList = []
      for (const req of mergedList) {
        let assignedCount = 0
        let phoneNum = req.phone || ''
        let companyName = 'AK Corporate'
        
        if (req.customer_id) {
          const { data: dbUser } = await supabase.from('users').select('phone, company_name').eq('id', req.customer_id).maybeSingle()
          if (dbUser) {
            phoneNum = dbUser.phone || phoneNum
            companyName = dbUser.company_name || 'AK Corporate'
          }
          
          const { data: pricings } = await supabase.from('customer_product_pricing').select('id').eq('customer_id', req.customer_id).eq('is_visible', true)
          assignedCount = pricings?.length || 0
        }
        
        enhancedList.push({
          ...req,
          phone: phoneNum,
          company: companyName,
          assigned_products_count: assignedCount
        })
      }
      return json(enhancedList)
    }

    if (method === 'PUT' && p[2]) {
      const requestId = p[2]
      const { status, customer_id } = body
      const now = new Date().toISOString()
      const finalStatus = status || 'approved'

      // Security check: validate products assignment count before approving
      if (finalStatus === 'approved') {
        if (!customer_id) return err('Customer ID required for approval validation', 400)
        const { data: pricings } = await supabase.from('customer_product_pricing').select('id').eq('customer_id', customer_id).eq('is_visible', true)
        if (!pricings || pricings.length === 0) {
          return err('Cannot approve customer catalog access: Please assign at least one product before approving catalog access.', 400)
        }
      }

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
      .select('id, email, full_name, phone, role, created_at, assigned_vendor_id')
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
      last_login_at: lastLoginMap[u.id] || u.created_at || null,
      assigned_vendor_id: u.assigned_vendor_id || null
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

  if (p[0] === 'admin' && p[1] === 'activity-logs' && method === 'PUT') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const { action } = body || {}
    if (action === 'mark_all_read') {
      try {
        await supabase.from('activity_logs').update({ is_read: true }).eq('is_read', false)
      } catch (e) {}
      try {
        await supabase.from('settings').delete().eq('id', 'admin_activity_feed')
      } catch (e) {}
      return json({ ok: true })
    }
    if (action === 'clear_all') {
      try {
        await supabase.from('activity_logs').delete().neq('id', 'placeholder_only_does_not_exist')
      } catch (e) {}
      try {
        await supabase.from('settings').delete().eq('id', 'admin_activity_feed')
      } catch (e) {}
      return json({ ok: true })
    }
    return err('Invalid action')
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
      return json(s || {}, 200)
    }
    if (method === 'PUT') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('settings').upsert({ id: 'main', ...body, updated_at: new Date().toISOString() })
      return json({ ok: true })
    }
  }

  // ==================== SITE CONTENT (CMS) — PUBLIC ====================
  if (p[0] === 'site-content' && method === 'GET') {
    const page = url.searchParams.get('page')
    const { data, error } = await supabase
      .from('settings')
      .select('b2b_customer_logins')
      .eq('id', 'main')
      .maybeSingle()

    if (error) return json([], 200)

    let cms = {}
    if (data && data.b2b_customer_logins) {
      cms = typeof data.b2b_customer_logins === 'string'
        ? JSON.parse(data.b2b_customer_logins)
        : data.b2b_customer_logins
      if (Array.isArray(cms)) cms = {}
    }

    const rows = []
    for (const [key, item] of Object.entries(cms)) {
      const parts = key.split(':')
      if (parts.length === 2) {
        const [p, s] = parts
        if (!page || p === page) {
          rows.push({
            page: p,
            section: s,
            content_type: item.type,
            content_value: item.value
          })
        }
      }
    }
    return json(rows, 200)
  }

  // ==================== ADMIN SITE CONTENT — MANAGEMENT ====================
  if (p[0] === 'admin' && p[1] === 'site-content' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const page = url.searchParams.get('page')
    
    const { data, error } = await supabase
      .from('settings')
      .select('b2b_customer_logins')
      .eq('id', 'main')
      .maybeSingle()

    if (error) return err('Failed to fetch settings: ' + error.message, 500)

    let cms = {}
    if (data && data.b2b_customer_logins) {
      cms = typeof data.b2b_customer_logins === 'string'
        ? JSON.parse(data.b2b_customer_logins)
        : data.b2b_customer_logins
      if (Array.isArray(cms)) cms = {}
    }

    const rows = []
    for (const [key, item] of Object.entries(cms)) {
      const parts = key.split(':')
      if (parts.length === 2) {
        const [p, s] = parts
        if (!page || p === page) {
          rows.push({
            page: p,
            section: s,
            content_type: item.type,
            content_value: item.value
          })
        }
      }
    }
    return json(rows)
  }

  if (p[0] === 'admin' && p[1] === 'site-content' && method === 'PUT') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const { rows } = body
    if (!Array.isArray(rows)) return err('rows array required', 400)

    const { data, error: fetchErr } = await supabase
      .from('settings')
      .select('b2b_customer_logins')
      .eq('id', 'main')
      .maybeSingle()

    if (fetchErr) return err('Failed to fetch settings: ' + fetchErr.message, 500)

    let cms = {}
    if (data && data.b2b_customer_logins) {
      cms = typeof data.b2b_customer_logins === 'string'
        ? JSON.parse(data.b2b_customer_logins)
        : data.b2b_customer_logins
      if (Array.isArray(cms)) cms = {}
    }

    for (const row of rows) {
      if (!row.page || !row.section) continue
      cms[`${row.page}:${row.section}`] = {
        value: row.content_value || '',
        type: row.content_type || 'text'
      }
    }

    const { error: saveErr } = await supabase
      .from('settings')
      .update({ b2b_customer_logins: cms })
      .eq('id', 'main')

    if (saveErr) return err('Failed to save settings: ' + saveErr.message, 500)
    return json({ ok: true })
  }

  if (p[0] === 'banners') {
    if (method === 'GET') {
      const { data: list } = await supabase.from('banners').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      return json(list || [], 200)
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
      return json(list || [], 200)
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
    if (!message || !sessionId) return err('Message and sessionId required', 400)
    
    const now = new Date().toISOString()
    const msgLower = message.toLowerCase().trim()
    let responseText = ''
    let suggestions = []
    let fallbackToAI = false
    let isWhatsAppHandoff = false
    
    const supabase = db()
    const user = await getUser(req)
    
    // Fetch logged-in customer context for chatbot personalization
    let customerContext = "User is a Guest (not logged in)."
    if (user) {
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('full_name, email, company_name, business_name, phone')
          .eq('id', user.id)
          .maybeSingle()
          
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('order_number, total, status, placed_at')
          .eq('user_id', user.id)
          .order('placed_at', { ascending: false })
          .limit(3)
          
        if (dbUser) {
          customerContext = `Current User is Logged In:\n` +
            `- Name: ${dbUser.full_name || 'N/A'}\n` +
            `- Email: ${dbUser.email || 'N/A'}\n` +
            `- Company: ${dbUser.company_name || dbUser.business_name || 'N/A'}\n` +
            `- Phone: ${dbUser.phone || 'N/A'}\n`
            
          if (recentOrders && recentOrders.length > 0) {
            customerContext += `Recent Orders:\n` +
              recentOrders.map(o => `  * Order #${o.order_number} | Total: ₹${o.total.toLocaleString('en-IN')} | Status: ${o.status.toUpperCase()} | Placed: ${new Date(o.placed_at).toLocaleDateString('en-IN')}`).join('\n')
          } else {
            customerContext += `Recent Orders: None`
          }
        }
      } catch (e) {
        console.warn('Could not load user details for chatbot context:', e.message)
      }
    }
    
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

CUSTOMER PROFILE & HISTORY (Personalize answers if they ask about their profile, orders, or name):
${customerContext}

Tone & Formatting: Professional, friendly, helpful, concise, corporate. Speak in clear English (or Hinglish if the user asks in Hindi).
Always prefer concise, mobile-friendly markdown formatting (e.g. bold **text** for emphasis). Use short bullet points or numbered lists instead of wide markdown tables where possible, as tables are hard to read on narrow phone screens. Keep responses brief.

Current Conversation History:\n` +
          (history || []).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
          
          const payload = {
            model: "google/gemini-2.5-flash",
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
      const { question, answer } = body
      if (!question || !answer) return err('Missing question or answer', 400)
      const doc = { id: uuidv4(), ...body, created_at: now, updated_at: now }
      const { error } = await supabase.from('faqs').insert(doc)
      if (error) return err(error.message, 500)
      return json(doc)
    }
    if (method === 'PUT' && p[2]) {
      if (body.hasOwnProperty('question') && !body.question) return err('Question cannot be empty', 400)
      if (body.hasOwnProperty('answer') && !body.answer) return err('Answer cannot be empty', 400)
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

    const { full_name, email, phone, password, role = 'customer', business_name, company_name } = body
    if (!full_name || !email || !password) return err('Name, Email, and Password required', 400)

    const cleanEmail = email.trim().toLowerCase()

    // Check if user already exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', cleanEmail).maybeSingle()
    if (existingUser) return err('An account with this email address already exists', 409)

    // 1. Create in Supabase Auth
    const { data: newAuthUser, error: authErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, plain_password: password }
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
      company_name: company_name ? company_name.trim() : (role === 'customer' ? full_name.trim() : ''),
      business_name: business_name ? business_name.trim() : (role === 'customer' ? full_name.trim() : ''),
      phone: phone ? phone.trim() : '',
      role: role === 'vendor' ? 'vendor' : 'customer',
      created_at: nowStr,
      assigned_vendor_id: body.assigned_vendor_id || null
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

  // ==================== ADMIN RETRIEVE USER CREDENTIALS ====================
  if (p[0] === 'admin' && p[1] === 'user-credentials' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)
    const targetId = url.searchParams.get('user_id')
    if (!targetId) return err('User ID required', 400)

    try {
      const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(targetId)
      if (authErr || !authUser?.user) {
        return err('Failed to retrieve authentication account: ' + (authErr?.message || 'Not found'), 404)
      }

      const { data: dbUser } = await supabase.from('users').select('id, email, full_name, phone, role, updated_at, assigned_vendor_id').eq('id', targetId).maybeSingle()

      // Look up assigned Zonal Admin details if vendor is assigned
      let assigned_zonal_admin_name = 'Not Assigned'
      let assigned_zonal_admin_email = 'Not Assigned'
      if (dbUser?.assigned_vendor_id) {
        const { data: vendor } = await supabase.from('vendors').select('name, email').eq('id', dbUser.assigned_vendor_id).maybeSingle()
        if (vendor) {
          assigned_zonal_admin_name = vendor.name || 'Not Assigned'
          assigned_zonal_admin_email = vendor.email || 'Not Assigned'
        }
      }

      return json({
        id: targetId,
        full_name: dbUser?.full_name || authUser.user.user_metadata?.full_name || 'User',
        email: dbUser?.email || authUser.user.email,
        phone: dbUser?.phone || authUser.user.phone || '',
        role: dbUser?.role || authUser.user.user_metadata?.role || 'customer',
        plain_password: authUser.user.user_metadata?.plain_password || '',
        updated_at: dbUser?.updated_at || authUser.user.updated_at || '',
        assigned_vendor_id: dbUser?.assigned_vendor_id || null,
        assigned_zonal_admin_name,
        assigned_zonal_admin_email
      })
    } catch (e) {
      return err('Failed to load credentials: ' + e.message, 500)
    }
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

    // 1. Update password in Supabase Auth (along with plain_password backup metadata)
    const { error: authErr } = await supabase.auth.admin.updateUserById(targetUserId, { 
      password: new_password,
      user_metadata: { plain_password: new_password }
    })
    if (authErr) {
      console.error('[Admin Reset Password Auth Fail]:', authErr)
      return err('Failed to update authentication password: ' + authErr.message, 500)
    }

    // 2. Update password in custom public.users table
    await supabase.from('users').update({ 
      password: hashPw(new_password)
    }).eq('id', targetUserId)

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
      const supabase = db()
      const vendors = await getVendorsList()
      const { data: disabledStore } = await supabase.from('settings').select('marquee_messages').eq('id', 'disabled_vendors').maybeSingle()
      const disabledList = disabledStore?.marquee_messages || []
      
      const mapped = (vendors || []).map(v => ({
        ...v,
        is_enabled: !disabledList.includes(v.id)
      }))
      return json(mapped)
    }

    if (method === 'PUT') {
      const { id, is_enabled } = body
      if (!id) return err('Zonal Admin ID required', 400)

      const supabase = db()
      const { data: disabledStore } = await supabase.from('settings').select('marquee_messages').eq('id', 'disabled_vendors').maybeSingle()
      let disabledList = disabledStore?.marquee_messages || []

      if (is_enabled) {
        disabledList = disabledList.filter(vId => vId !== id)
      } else {
        if (!disabledList.includes(id)) {
          disabledList.push(id)
        }
      }

      const { error: upsertErr } = await supabase.from('settings').upsert({
        id: 'disabled_vendors',
        marquee_messages: disabledList
      })

      if (upsertErr) {
        console.error('[Vendor Enable/Disable Error]:', upsertErr)
        return err('Failed to update vendor status: ' + upsertErr.message, 500)
      }

      return json({ success: true, is_enabled })
    }

    if (method === 'POST') {
      const { name, phone, email, password } = body
      if (!name || !email || !password) return err('Name, Email, and Password required', 400)

      const { data: newAuthUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role: 'vendor', plain_password: password }
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
      console.error(`[Vendor Audit] User ${user.email} (ID: ${user.id}) has role=vendor but no record in vendors table yet.`)
      return err('Zonal Admin profile not linked, contact owner', 403)
    }

    if (method === 'GET') {
      // NOTE: vendor_accepted & vendor_accepted_at columns do NOT exist in DB.
      // Derive vendor_accepted from status field instead.
      let ordersSelect = 'id, order_number, status, total, payment_method, placed_at, updated_at, zoho_invoice_status, zoho_invoice_id, zoho_challan_id, addresses(*), order_items(id, product_name_snapshot, quantity, price_snapshot, products(hsn_code))'
      let query = supabase.from('orders').select(ordersSelect)
      if (user.role !== 'admin' && vendor) {
        query = query.eq('assigned_vendor_id', vendor.id)
      }

      let { data: orders, error } = await query.order('placed_at', { ascending: false })
      if (error && error.message.includes('zoho_invoice_status')) {
        ordersSelect = 'id, order_number, status, total, payment_method, placed_at, updated_at, zoho_invoice_id, zoho_challan_id, addresses(*), order_items(id, product_name_snapshot, quantity, price_snapshot, products(hsn_code))'
        let fallbackQuery = supabase.from('orders').select(ordersSelect)
        if (user.role !== 'admin' && vendor) {
          fallbackQuery = fallbackQuery.eq('assigned_vendor_id', vendor.id)
        }
        const fallbackRes = await fallbackQuery.order('placed_at', { ascending: false })
        orders = fallbackRes.data
        error = fallbackRes.error
      }

      if (error) {
        console.error('[Vendor Orders Query Fail]:', { table: 'orders', code: error.code, message: error.message })
        return err('Failed to fetch assigned orders: ' + error.message, 500)
      }

      const VENDOR_ACCEPTED_STATUSES = ['vendor_accepted', 'vendor_accepted_pending_admin_approval', 'packed', 'shipped', 'out_for_delivery', 'delivered']
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
          items: o.order_items || [],
          zoho_invoice_status: o.zoho_invoice_status || (o.zoho_invoice_id ? 'synced' : 'pending'),
          zoho_invoice_id: o.zoho_invoice_id,
          zoho_challan_id: o.zoho_challan_id
        }
      })

      return json(mapped)
    }

    if (method === 'PUT' && p[2]) {
      const { status, action } = body
      const nowStr = new Date().toISOString()
      const updateData = { updated_at: nowStr }

      // New workflow: vendor can only ACCEPT or REJECT orders in "pending_vendor_acceptance" status
      // All other status updates (packed/shipped/delivered) are admin-only
      if (action === 'accept' || status === 'accepted' || status === 'confirmed') {
        // Verify order is in pending_vendor_acceptance status
        const { data: orderToAccept } = await supabase.from('orders').select('id, status, order_number, user_id, status_history').eq('id', p[2]).maybeSingle()
        if (!orderToAccept) return err('Order not found', 404)
        if (orderToAccept.status !== 'pending_vendor_acceptance') {
          return err('This order cannot be accepted — it may have already been processed', 400)
        }
        updateData.status = 'vendor_accepted_pending_admin_approval'
        // Persist status_history so customer timeline updates
        const history = Array.isArray(orderToAccept.status_history) ? [...orderToAccept.status_history] : []
        history.push({ status: 'vendor_accepted_pending_admin_approval', note: `Accepted by ${vendor?.name || 'Zonal Admin'} — awaiting Owner final approval`, timestamp: nowStr })
        updateData.status_history = history
        // Notify admin that vendor accepted — needs final approval
        try {
          await supabase.from('activity_logs').insert({
            id: uuidv4(),
            user_id: user.id,
            user_name: vendor?.name || user.full_name || 'Zonal Admin',
            user_email: user.email,
            event_type: 'order',
            category: 'orders',
            title: `Order #${orderToAccept.order_number} accepted by ${vendor?.name || 'vendor'} — awaiting your final approval`,
            description: 'Zonal Admin accepted — Owner must now confirm or reject the order',
            metadata: { order_id: p[2], order_number: orderToAccept.order_number },
            created_at: nowStr
          })
        } catch (actErr) {
          console.warn('Admin notification insert failed:', actErr.message)
        }
      } else if (action === 'reject' || status === 'vendor_rejected' || status === 'rejected') {
        // Verify order is in pending_vendor_acceptance status
        const { data: orderToReject } = await supabase.from('orders').select('id, status, order_number, user_id, status_history').eq('id', p[2]).maybeSingle()
        if (!orderToReject) return err('Order not found', 404)
        if (orderToReject.status !== 'pending_vendor_acceptance') {
          return err('This order cannot be rejected — it may have already been processed', 400)
        }
        updateData.status = 'vendor_rejected'
        updateData.rejection_reason = body.rejection_reason || `Rejected by ${vendor?.name || 'vendor'}`
        // Persist status_history so customer timeline updates
        const history = Array.isArray(orderToReject.status_history) ? [...orderToReject.status_history] : []
        history.push({ status: 'vendor_rejected', note: `Rejected by ${vendor?.name || 'Zonal Admin'}. ${updateData.rejection_reason}`, timestamp: nowStr })
        updateData.status_history = history
        // Notify admin that vendor rejected
        try {
          await supabase.from('activity_logs').insert({
            id: uuidv4(),
            user_id: user.id,
            user_name: vendor?.name || user.full_name || 'Zonal Admin',
            user_email: user.email,
            event_type: 'order',
            category: 'orders',
            title: `Order #${orderToReject.order_number} rejected by ${vendor?.name || 'vendor'}`,
            description: 'Needs reassignment by admin',
            metadata: { order_id: p[2], order_number: orderToReject.order_number },
            created_at: nowStr
          })
        } catch (actErr) {
          console.warn('Admin notification insert failed:', actErr.message)
        }
      } else {
        return err('Vendors can only accept or reject pending orders. Status updates like packed/shipped/delivered are admin-only.', 400)
      }

      let { error } = await supabase.from('orders').update(updateData).eq('id', p[2])
      if (error && error.code === '23514' && updateData.status === 'vendor_accepted_pending_admin_approval') {
        console.warn('[Constraint Error]: vendor_accepted_pending_admin_approval not allowed. Retrying with vendor_accepted status.')
        updateData.status = 'vendor_accepted'
        if (Array.isArray(updateData.status_history)) {
          const lastIdx = updateData.status_history.length - 1
          if (lastIdx >= 0) {
            updateData.status_history[lastIdx].status = 'vendor_accepted'
            updateData.status_history[lastIdx].note = `Accepted by ${vendor?.name || 'Zonal Admin'}`
          }
        }
        const retryRes = await supabase.from('orders').update(updateData).eq('id', p[2])
        error = retryRes.error
      }
      if (error) {
        console.error('[Vendor Order Update Fail]:', { table: 'orders', code: error.code, message: error.message })
        return err('Failed to update status: ' + error.message, 500)
      }
      return json({ ok: true, ...updateData })
    }
  }

  // ==================== VENDOR DASHBOARD STATS ====================
  // GET /api/vendor/dashboard-stats?range=today|this-week|this-month|all
  // Aggregates the current vendor's assigned orders (COUNT / SUM / AVG).
  if (p[0] === 'vendor' && p[1] === 'dashboard-stats' && method === 'GET') {
    if (!user) return err('Unauthorized', 401)
    const vendor = await getVendorByUserId(user.id, user.email)
    if (!vendor && user.role !== 'admin') {
      return err('Zonal Admin profile not linked, contact owner', 403)
    }
    if (!vendor) return err('Zonal Admin not found', 404)

    const rawRange = url.searchParams.get('range') || 'all'
    const range = rawRange === 'all-time' ? 'all' : rawRange
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const bounds = getDateRange(range, startDateParam, endDateParam)
    const { start, end } = bounds

    const { data: assignedOrders, error: fetchErr } = await supabase
      .from('orders')
      .select('id, total, status, placed_at, assigned_vendor_id')
      .eq('assigned_vendor_id', vendor.id)

    if (fetchErr) return err('Failed to fetch vendor stats: ' + fetchErr.message, 500)

    const allOrders = assignedOrders || []
    const within = o => {
      if (!start || !end) return true
      const t = new Date(o.placed_at).getTime()
      return !isNaN(t) && t >= start.getTime() && t <= end.getTime()
    }
    const sumNonCancelled = arr => arr.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0)

    // All-time assigned totals
    const totalOrders = allOrders.length
    const totalRevenue = sumNonCancelled(allOrders)

    // Current IST month totals
    const monthBounds = getDateRange('this-month')
    const isThisMonth = o => {
      const t = new Date(o.placed_at).getTime()
      return !isNaN(t) && t >= monthBounds.start.getTime() && t <= monthBounds.end.getTime()
    }
    const thisMonthOrders = allOrders.filter(o => o.status !== 'cancelled' && isThisMonth(o))
    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)

    // Selected-range totals (drives Revenue + Avg Order Value KPI)
    const rangeOrders = allOrders.filter(o => o.status !== 'cancelled' && within(o))
    const rangeRevenue = rangeOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const count = rangeOrders.length

    return json({
      range,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      thisMonthOrders: thisMonthOrders.length,
      thisMonthRevenue: Math.round(thisMonthRevenue * 100) / 100,
      rangeOrders: count,
      rangeRevenue: Math.round(rangeRevenue * 100) / 100,
      avgOrderValue: count > 0 ? Math.round((rangeRevenue / count) * 100) / 100 : 0
    })
  }

  // ==================== VENDOR INVENTORY (READ-ONLY) ====================
  if (p[0] === 'vendor' && p[1] === 'inventory' && method === 'GET') {
    if (!user || (user.role !== 'vendor' && user.role !== 'admin')) {
      return err('Forbidden — Zonal Admin access required', 403)
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

  // ==================== ADMIN MONTHLY TRENDS ====================
  if (p[0] === 'admin' && p[1] === 'monthly-trends' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    const now = new Date()
    const trends = []

    // Build last 12 calendar months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      const { data: monthOrders } = await supabase
        .from('orders')
        .select('total, status')
        .gte('placed_at', monthStart)
        .lte('placed_at', monthEnd)

      let revenue = 0
      let count = 0
      for (const o of (monthOrders || [])) {
        if (o.status !== 'cancelled' && o.status !== 'rejected') {
          revenue += o.total || 0
          count++
        }
      }
      trends.push({ month: monthKey, orders: count, revenue: Math.round(revenue * 100) / 100 })
    }
    return json(trends)
  }

  // ==================== ADMIN CUSTOMERS ====================
  if (p[0] === 'admin' && p[1] === 'customers' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden', 403)
    const supabase = db()
    const q = url.searchParams.get('q') || ''
    
    let query = supabase.from('users').select('id, email, full_name, phone, role, created_at, gst_number, company_name').eq('role', 'customer')
    if (q) {
      let filterStr = `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%,gst_number.ilike.%${q}%`
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q)
      if (isUuid) {
        filterStr += `,id.eq.${q}`
      }
      query = query.or(filterStr)
    }
    
    const { data: usersList } = await query
    
    const userIds = (usersList || []).map(u => u.id)
    let ordersList = []
    if (userIds.length > 0) {
      const { data } = await supabase
        .from('orders')
        .select('user_id, total, status, placed_at')
        .in('user_id', userIds)
      ordersList = data || []
    }
    
    const customerMap = {}
    for (const u of (usersList || [])) {
      customerMap[u.id] = {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        phone: u.phone,
        created_at: u.created_at,
        gst_number: u.gst_number,
        company_name: u.company_name,
        ordersCount: 0,
        totalSpent: 0,
        lastOrderDate: null
      }
    }
    
    for (const ord of ordersList) {
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

  // ==================== ADMIN DELETE ACCOUNT ====================
  if (p[0] === 'admin' && p[1] === 'delete-account' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)

    const { user_id } = body
    if (!user_id) return err('User ID required', 400)

    const supabase = db()

    // Check if user has existing orders
    const { data: orders } = await supabase.from('orders').select('id').eq('user_id', user_id).limit(1)
    if (orders && orders.length > 0) {
      return err('Cannot delete: this account has order history. Consider deactivating instead.', 400)
    }

    // Look up user info before deletion
    const { data: targetUser } = await supabase.from('users').select('id, email, role').eq('id', user_id).maybeSingle()
    if (!targetUser) return err('User not found', 404)

    // Delete from Supabase Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(user_id)
    if (authErr) {
      console.error('[Admin Delete Account Auth Fail]:', authErr)
    }

    // Delete customer_product_pricing rows
    await supabase.from('customer_product_pricing').delete().eq('user_id', user_id)

    // Delete customer_logins rows
    await supabase.from('customer_logins').delete().eq('user_id', user_id)

    // Delete from users table
    await supabase.from('users').delete().eq('id', user_id)

    // If vendor, also delete from vendors table
    if (targetUser.role === 'vendor') {
      await supabase.from('vendors').delete().eq('user_id', user_id)
    }

    return json({ success: true, message: 'Account deleted successfully' })
  }

  // ==================== ADMIN DEACTIVATE ACCOUNT ====================
  if (p[0] === 'admin' && p[1] === 'deactivate-account' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)

    const { user_id } = body
    if (!user_id) return err('User ID required', 400)

    const supabase = db()

    const { error } = await supabase.from('users').update({ status: 'deactivated' }).eq('id', user_id)
    if (error) return err('Failed to deactivate account: ' + error.message, 500)

    return json({ success: true, message: 'Account deactivated successfully' })
  }

  // ==================== ADMIN USER PROFILE ====================
  if (p[0] === 'admin' && p[1] === 'user-profile' && method === 'GET') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)

    const targetUserId = url.searchParams.get('user_id')
    console.log('[User Profile] Fetching profile for user_id:', targetUserId, '| full URL:', req.url)
    if (!targetUserId) return err('User ID required', 400)

    try {
      const supabase = db()

      // Fetch user info (removed 'status' as it is not present in the users schema)
      const { data: userData, error: userErr } = await supabase.from('users').select('id, email, full_name, phone, role, created_at, assigned_vendor_id').eq('id', targetUserId).maybeSingle()
      if (userErr) {
        console.error('[User Profile] DB error fetching users table for ID:', targetUserId, 'Error:', {
          message: userErr.message,
          code: userErr.code,
          details: userErr.details,
          hint: userErr.hint
        })
        return err('Database error: ' + userErr.message, 500)
      }
      if (!userData) {
        console.warn('[User Profile] User not found in users table for ID:', targetUserId)
        return err('User not found: no user with ID ' + targetUserId, 404)
      }

      // Fetch last login
      const { data: lastLogin, error: loginErr } = await supabase.from('customer_logins').select('login_at').eq('user_id', targetUserId).order('login_at', { ascending: false }).limit(1).maybeSingle()
      if (loginErr) {
        console.error('[User Profile] DB error fetching customer_logins table for ID:', targetUserId, 'Error:', {
          message: loginErr.message,
          code: loginErr.code,
          details: loginErr.details,
          hint: loginErr.hint
        })
      }

      // Fetch orders
      const { data: orders, error: ordersErr } = await supabase.from('orders').select('id, order_number, total, status, placed_at, updated_at, order_items(id, product_name_snapshot, quantity)').eq('user_id', targetUserId).order('placed_at', { ascending: false })
      if (ordersErr) {
        console.error('[User Profile] DB error fetching orders table for ID:', targetUserId, 'Error:', {
          message: ordersErr.message,
          code: ordersErr.code,
          details: ordersErr.details,
          hint: ordersErr.hint
        })
      }

      const ordersList = orders || []
      const totalOrders = ordersList.length
      const totalSpent = ordersList.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.total || 0), 0)
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

      const statusBreakdown = {}
      for (const o of ordersList) {
        statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1
      }

      let catalogSummary = null
      if (userData.role === 'customer') {
        // Fix: customer_product_pricing table uses 'customer_id' not 'user_id'
        const { data: catalog, error: catalogErr } = await supabase.from('customer_product_pricing').select('id').eq('customer_id', targetUserId)
        if (catalogErr) {
          console.error('[User Profile] DB error fetching customer_product_pricing for customer:', targetUserId, 'Error:', {
            message: catalogErr.message,
            code: catalogErr.code,
            details: catalogErr.details,
            hint: catalogErr.hint
          })
        }
        catalogSummary = { visibleProducts: catalog?.length || 0 }
      }

      let vendorStats = null
      if (userData.role === 'vendor') {
        const { data: vendor, error: vendorErr } = await supabase.from('vendors').select('id').eq('user_id', targetUserId).maybeSingle()
        if (vendorErr) {
          console.error('[User Profile] DB error fetching vendor record for user:', targetUserId, 'Error:', {
            message: vendorErr.message,
            code: vendorErr.code,
            details: vendorErr.details,
            hint: vendorErr.hint
          })
        }
        if (vendor) {
          // Fix: orders table uses 'assigned_vendor_id' not 'vendor_id'
          const { data: assignedOrders, error: assignedErr } = await supabase.from('orders').select('id, status, placed_at, updated_at').eq('assigned_vendor_id', vendor.id)
          if (assignedErr) {
            console.error('[User Profile] DB error fetching orders for vendor ID:', vendor.id, 'Error:', {
              message: assignedErr.message,
              code: assignedErr.code,
              details: assignedErr.details,
              hint: assignedErr.hint
            })
          }
          const assigned = assignedOrders || []
          vendorStats = {
            totalFulfilled: assigned.filter(o => o.status === 'delivered').length,
            currentlyAssigned: assigned.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length,
            totalAssigned: assigned.length
          }
        }
      }

      return json({
        user: {
          ...userData,
          status: 'active', // default status to active since users table doesn't have status column
          last_login_at: lastLogin?.login_at || null
        },
        orderStats: {
          totalOrders,
          totalSpent,
          avgOrderValue,
          statusBreakdown
        },
        orders: ordersList.map(o => ({
          id: o.id,
          order_number: o.order_number,
          total: o.total,
          status: o.status,
          placed_at: o.placed_at,
          updated_at: o.updated_at,
          itemCount: o.order_items?.length || 0
        })),
        catalogSummary,
        vendorStats
      })
    } catch (e) {
      console.error('[User Profile] Unexpected error handling request:', e)
      return err('Failed to load profile: ' + e.message, 500)
    }
  }

  // ==================== ADMIN UPDATE USER PROFILE (VENDOR ASSIGNMENT) ====================
  if (p[0] === 'admin' && p[1] === 'user-profile' && method === 'PUT') {
    console.log('[DEBUG Admin User-Profile PUT] Incoming body:', body, 'targetUserId:', body?.user_id)
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)

    const targetUserId = body.user_id
    const assignedVendorId = body.assigned_vendor_id !== undefined ? body.assigned_vendor_id : undefined

    if (!targetUserId) return err('User ID required', 400)

    try {
      const supabase = db()
      const updatePayload = { updated_at: new Date().toISOString() }
      if (assignedVendorId !== undefined) {
        updatePayload.assigned_vendor_id = assignedVendorId
      }

      // Fetch vendor details beforehand if we are assigning a new vendor
      let vendorRecord = null
      if (assignedVendorId) {
        const { data } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', assignedVendorId)
          .maybeSingle()
        vendorRecord = data
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', targetUserId)

      if (updateErr) {
        console.error('[User Profile Update Error]:', updateErr)
        return NextResponse.json({
          error: 'Failed to update customer: ' + updateErr.message,
          message: updateErr.message,
          code: updateErr.code,
          details: updateErr.details,
          hint: updateErr.hint,
          ok: false
        }, { status: 500 })
      }

      // AUTOMATIC FIX (root cause): Update un-delivered orders for this customer
      if (assignedVendorId !== undefined) {
        // Find existing non-fulfilled orders
        const { data: existingOrders } = await supabase
          .from('orders')
          .select('id, status, status_history')
          .eq('user_id', targetUserId)
          .not('status', 'in', '("delivered","cancelled","rejected")')

        if (existingOrders && existingOrders.length > 0) {
          for (const ord of existingOrders) {
            const orderUpdate = {}
            let finalStatus = ord.status

            if (assignedVendorId && vendorRecord) {
              orderUpdate.assigned_vendor_id = vendorRecord.id
              orderUpdate.vendor_name = vendorRecord.name || ''
              orderUpdate.vendor_email = vendorRecord.email || ''
              orderUpdate.assigned_at = new Date().toISOString()
              orderUpdate.assigned_by = 'Auto-Assign on Zonal Admin Update'

              if (ord.status === 'confirmed' || ord.status === 'pending') {
                finalStatus = 'vendor_assigned'
                orderUpdate.status = finalStatus
              }
            } else {
              orderUpdate.assigned_vendor_id = null
              orderUpdate.vendor_name = null
              orderUpdate.vendor_email = null
              orderUpdate.assigned_at = null
              orderUpdate.assigned_by = null

              if (ord.status === 'vendor_assigned') {
                finalStatus = 'confirmed'
                orderUpdate.status = finalStatus
              }
            }

            const history = Array.isArray(ord.status_history) ? [...ord.status_history] : []
            history.push({
              status: finalStatus,
              note: assignedVendorId && vendorRecord
                ? `Zonal Admin Auto-Assigned: ${vendorRecord.name} (Customer pricing profile updated)`
                : `Zonal Admin Unassigned (Customer pricing profile updated)`,
              timestamp: new Date().toISOString()
            })
            orderUpdate.status_history = history

            await supabase.from('orders').update(orderUpdate).eq('id', ord.id)
          }
        }
      }

      return json({ ok: true, message: 'Customer vendor assignment updated successfully' })
    } catch (e) {
      console.error('[User Profile Update Unexpected]:', e)
      return NextResponse.json({
        error: 'Internal error: ' + e.message,
        message: e.message,
        ok: false
      }, { status: 500 })
    }
  }

  // ==================== ADMIN ORDER RESYNC VENDOR (MANUAL & BULK) ====================
  if (p[0] === 'admin' && p[1] === 'orders' && p[2] === 'resync-vendor' && p[3] && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)
    const orderId = p[3]
    try {
      const supabase = db()
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, user_id, order_number, status_history, status')
        .eq('id', orderId)
        .maybeSingle()

      if (orderErr || !order) return err('Order not found', 404)

      const { data: orderUser, error: userErr } = await supabase
        .from('users')
        .select('assigned_vendor_id')
        .eq('id', order.user_id)
        .maybeSingle()

      if (userErr || !orderUser || !orderUser.assigned_vendor_id) {
        return err('No vendor assigned to this customer', 400)
      }

      const { data: vendorRecord, error: vendorErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', orderUser.assigned_vendor_id)
        .maybeSingle()

      if (vendorErr || !vendorRecord) return err('Assigned vendor record not found', 404)

      const updatePayload = {
        assigned_vendor_id: vendorRecord.id,
        vendor_name: vendorRecord.name || '',
        vendor_email: vendorRecord.email || '',
        assigned_at: new Date().toISOString(),
        assigned_by: 'Admin Manual Resync'
      }

      let finalStatus = order.status
      if (order.status === 'confirmed' || order.status === 'pending') {
        finalStatus = 'vendor_assigned'
        updatePayload.status = finalStatus
      }

      const history = Array.isArray(order.status_history) ? [...order.status_history] : []
      history.push({
        status: finalStatus,
        note: `Zonal Admin Manually Re-synced: ${vendorRecord.name} (Assigned by Owner)`,
        timestamp: new Date().toISOString()
      })
      updatePayload.status_history = history

      const { error: updateErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

      if (updateErr) return err('Failed to update order: ' + updateErr.message, 500)

      return json({ ok: true, message: 'Zonal Admin successfully re-synced to order', order: updatePayload })
    } catch (e) {
      console.error('[Admin Order Resync Unexpected]:', e)
      return err('Internal error: ' + e.message, 500)
    }
  }

  if (p[0] === 'admin' && p[1] === 'orders' && p[2] === 'resync-all-unassigned' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)
    try {
      const supabase = db()
      const { data: unassignedOrders, error: fetchErr } = await supabase
        .from('orders')
        .select('id, user_id, order_number, status_history, status')
        .or('vendor_name.is.null,vendor_name.eq.""')
        .not('status', 'in', '("delivered","cancelled","rejected")')

      if (fetchErr) return err('Failed to fetch orders: ' + fetchErr.message, 500)
      if (!unassignedOrders || unassignedOrders.length === 0) {
        return json({ ok: true, message: 'No unassigned orders found', updatedCount: 0 })
      }

      let updatedCount = 0
      for (const order of unassignedOrders) {
        const { data: orderUser } = await supabase
          .from('users')
          .select('assigned_vendor_id')
          .eq('id', order.user_id)
          .maybeSingle()

        if (orderUser?.assigned_vendor_id) {
          const { data: vendorRecord } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', orderUser.assigned_vendor_id)
            .maybeSingle()

          if (vendorRecord) {
            const updatePayload = {
              assigned_vendor_id: vendorRecord.id,
              vendor_name: vendorRecord.name || '',
              vendor_email: vendorRecord.email || '',
              assigned_at: new Date().toISOString(),
              assigned_by: 'Admin Bulk Resync'
            }

            let finalStatus = order.status
            if (order.status === 'confirmed' || order.status === 'pending') {
              finalStatus = 'vendor_assigned'
              updatePayload.status = finalStatus
            }

            const history = Array.isArray(order.status_history) ? [...order.status_history] : []
            history.push({
              status: finalStatus,
              note: `Zonal Admin Bulk Re-synced: ${vendorRecord.name} (Assigned by Owner)`,
              timestamp: new Date().toISOString()
            })
            updatePayload.status_history = history

            await supabase.from('orders').update(updatePayload).eq('id', order.id)
            updatedCount++
          }
        }
      }

      return json({ ok: true, message: `Successfully updated ${updatedCount} orders`, updatedCount })
    } catch (e) {
      console.error('[Admin Bulk Resync Unexpected]:', e)
      return err('Internal error: ' + e.message, 500)
    }
  }

  if (p[0] === 'admin' && p[1] === 'factory-reset' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)
    try {
      const { confirmText, includeProductsCategories, password } = body || {}
      if (confirmText !== 'DELETE ALL DATA') {
        return err('Invalid confirmation text. Must type exactly "DELETE ALL DATA"', 400)
      }
      
      const supabase = db()
      const { data: adminRecord } = await supabase.from('users').select('id, email, password').eq('id', user.id).maybeSingle()
      if (!adminRecord || adminRecord.password !== hashPw(password)) {
        return err('Re-authentication failed. Incorrect password.', 401)
      }

      const auditLogText = `[FACTORY RESET] Timestamp: ${new Date().toISOString()} | Admin: ${adminRecord.email} | Mode: ${includeProductsCategories ? 'Mode 2 (Includes Catalog)' : 'Mode 1 (Transactional Only)'}`
      console.log(auditLogText)

      // 1. Gather row counts before delete
      const tablesList = [
        'order_items', 'orders', 'return_requests', 'invoice_generation_logs',
        'wishlist_items', 'reviews', 'product_qa', 'customer_product_pricing',
        'customer_logins', 'addresses', 'notifications', 'activity_logs',
        'chat_logs', 'client_errors', 'bulk_enquiries', 'catalog_access_requests',
        'catalog_requests', 'inquiries', 'product_requests', 'newsletter',
        'vendors', 'clients'
      ]
      
      const summary = {}
      for (const table of tablesList) {
        try {
          const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
          summary[table] = count || 0
        } catch {
          summary[table] = 0
        }
      }
      
      try {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('id', 'eq', user.id)
        summary['profiles'] = count || 0
      } catch { summary['profiles'] = 0 }
      try {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).not('role', 'in', '("admin","owner")')
        summary['users'] = count || 0
      } catch { summary['users'] = 0 }

      if (includeProductsCategories) {
        try {
          const { count: pic } = await supabase.from('product_images').select('*', { count: 'exact', head: true })
          summary['product_images'] = pic || 0
        } catch { summary['product_images'] = 0 }
        try {
          const { count: pc } = await supabase.from('products').select('*', { count: 'exact', head: true })
          summary['products'] = pc || 0
        } catch { summary['products'] = 0 }
        try {
          const { count: cc } = await supabase.from('categories').select('*', { count: 'exact', head: true })
          summary['categories'] = cc || 0
        } catch { summary['categories'] = 0 }
      }

      // Helper to safely delete all rows
      async function clearTable(table) {
        let res = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (res.error && (res.error.message.includes('column "id" does not exist') || res.error.code === '42703')) {
          res = await supabase.from(table).delete().neq('email', 'never_match_this_val')
          if (res.error && (res.error.message.includes('column "email" does not exist') || res.error.code === '42703')) {
            res = await supabase.from(table).delete().gt('created_at', '1970-01-01T00:00:00Z')
          }
        }
        if (res.error) {
          // Skip tables that don't exist (not an error - they just haven't been created yet)
          if (res.error.message.includes('Could not find the table') || res.error.code === '42P01') {
            console.log(`[Factory Reset] Skipping table ${table}: table does not exist yet`)
            return
          }
          console.error(`[Factory Reset] Error deleting all rows from ${table}:`, res.error.message)
        }
      }

      // 2. Perform deletes sequentially (child first)
      for (const table of tablesList) {
        await clearTable(table)
      }

      // Profiles (excluding current admin)
      try {
        await supabase.from('profiles').delete().not('id', 'eq', user.id)
      } catch (e) {
        console.error('[Factory Reset] Error deleting profiles:', e)
      }

      // Users (excluding admins/owners)
      try {
        await supabase.from('users').delete().not('role', 'in', '("admin","owner")')
      } catch (e) {
        console.error('[Factory Reset] Error deleting users:', e)
      }

      // 3. Clear Products/Categories (Mode 2)
      if (includeProductsCategories) {
        await clearTable('product_images')
        await clearTable('products')
        await clearTable('categories')
        
        // Remove storage files in product-images bucket
        try {
          const { data: files } = await supabase.storage.from('product-images').list()
          if (files && files.length > 0) {
            const paths = files.map(f => f.name)
            await supabase.storage.from('product-images').remove(paths)
          }
        } catch (e) {
          console.error('[Factory Reset] Error cleaning storage bucket:', e)
        }
      }

      return json({ ok: true, message: 'Website reset successfully', summary })
    } catch (e) {
      console.error('[Admin Factory Reset Unexpected]:', e)
      return err('Internal error: ' + e.message, 500)
    }
  }

  if (p[0] === 'admin' && p[1] === 'restore-backup' && method === 'POST') {
    if (!user || user.role !== 'admin') return err('Forbidden — Admin access required', 403)
    try {
      const { backupData, password } = body || {}
      if (!backupData || typeof backupData !== 'object') {
        return err('Invalid backup data. Upload a valid backup JSON file.', 400)
      }
      
      const supabase = db()
      // Re-authenticate admin
      const { data: adminRecord } = await supabase.from('users').select('id, email, password').eq('id', user.id).maybeSingle()
      if (!adminRecord || adminRecord.password !== hashPw(password)) {
        return err('Re-authentication failed. Incorrect password.', 401)
      }

      console.log(`[RESTORE BACKUP] Timestamp: ${new Date().toISOString()} | Admin: ${adminRecord.email}`)

      const results = {}

      // Helper: upsert rows into a table, skipping failures
      async function restoreTable(tableName, rows, idKey = 'id') {
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          results[tableName] = { restored: 0, skipped: 0 }
          return
        }
        let restored = 0
        let skipped = 0
        for (const row of rows) {
          try {
            // Clean row — remove any undefined values
            const cleanRow = {}
            for (const [k, v] of Object.entries(row)) {
              if (v !== undefined) cleanRow[k] = v
            }
            const { error } = await supabase.from(tableName).upsert(cleanRow, { onConflict: idKey, ignoreDuplicates: true })
            if (error) {
              console.error(`[Restore] ${tableName} skip row:`, error.message)
              skipped++
            } else {
              restored++
            }
          } catch {
            skipped++
          }
        }
        results[tableName] = { restored, skipped }
      }

      // Restore in parent-first order (reverse of deletion order)
      // 1. Users & Profiles first (parents)
      if (backupData.customers) {
        // Customers go into users table as role='customer'
        const userRows = backupData.customers.map(c => ({
          id: c.id,
          email: c.email,
          full_name: c.full_name || c.name || '',
          phone: c.phone || '',
          role: c.role || 'customer',
          password: c.password || '',
          gst_number: c.gst_number || null,
          company_name: c.company_name || null,
          is_active: c.is_active !== false,
          created_at: c.created_at || new Date().toISOString(),
        }))
        // Filter out admin/owner rows to not overwrite
        const safeRows = userRows.filter(r => r.role !== 'admin' && r.role !== 'owner')
        await restoreTable('users', safeRows)
        
        // Also restore profiles
        const profileRows = safeRows.map(c => ({
          id: c.id,
          full_name: c.full_name || c.name || '',
          email: c.email,
          phone: c.phone || '',
          company_name: c.company_name || null,
          gst_number: c.gst_number || null,
          address: c.address || null,
          city: c.city || null,
          state: c.state || null,
          pincode: c.pincode || null,
        }))
        await restoreTable('profiles', profileRows)
      }

      // 2. Vendors
      if (backupData.vendors) {
        await restoreTable('vendors', backupData.vendors)
      }

      // 3. Categories (before products)
      if (backupData.categories) {
        await restoreTable('categories', backupData.categories)
      }

      // 4. Products
      if (backupData.products) {
        await restoreTable('products', backupData.products)
      }

      // 5. Orders (parent before order_items)
      if (backupData.orders) {
        // Separate order items if embedded
        const orderRows = backupData.orders.map(o => {
          const { items, order_items, ...orderData } = o
          return orderData
        })
        await restoreTable('orders', orderRows)

        // Restore order items if they're embedded in orders
        const allItems = []
        for (const o of backupData.orders) {
          const items = o.items || o.order_items || []
          for (const item of items) {
            allItems.push({ ...item, order_id: item.order_id || o.id })
          }
        }
        if (allItems.length > 0) {
          await restoreTable('order_items', allItems)
        }
      }

      return json({ 
        ok: true, 
        message: 'Backup restored successfully', 
        results,
        restored_at: new Date().toISOString()
      })
    } catch (e) {
      console.error('[Admin Restore Backup Unexpected]:', e)
      return err('Internal error: ' + e.message, 500)
    }
  }

  return err('Not found', 404)
}

export async function GET(req)    { return route(req, 'GET') }
export async function POST(req)   { return route(req, 'POST') }
export async function PUT(req)    { return route(req, 'PUT') }
export async function DELETE(req) { return route(req, 'DELETE') }
export async function PATCH(req)  { return route(req, 'PATCH') }