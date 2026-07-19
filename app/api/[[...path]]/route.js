import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', parsed.email)
      .maybeSingle()
      
    if (dbUser && dbUser.id !== parsed.id) {
      console.log(`TRANSPARENT ID OVERRIDE FOR ${parsed.email}: Token ID ${parsed.id} -> Database ID ${dbUser.id}`)
      parsed.id = dbUser.id
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
  let statusStr = o.status || 'confirmed'
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
  
  const steps = ['confirmed', 'shipped', 'out for delivery', 'delivered']
  const currentKey = statusStr.toLowerCase().trim()
  const activeIdx = steps.indexOf(currentKey)
  
  if (activeIdx === -1) {
    statusHistory = [{ status: statusStr, timestamp: uAt, note: `Order status is ${statusStr}` }]
    if (currentKey === 'cancelled' || currentKey === 'returned') {
      statusHistory = [
        { status: 'confirmed', timestamp: pAt, note: 'Order placed and confirmed' },
        { status: statusStr, timestamp: uAt, note: `Order was ${statusStr}` }
      ]
    }
  } else {
    statusHistory = []
    for (let i = 0; i <= activeIdx; i++) {
      const stepKey = steps[i]
      let ts = pAt
      let note = 'Order placed and confirmed'
      
      if (i === activeIdx) {
        ts = uAt
      } else if (i > 0) {
        const pTime = new Date(pAt).getTime()
        const uTime = new Date(uAt).getTime()
        ts = new Date(pTime + (uTime - pTime) * (i / activeIdx)).toISOString()
      }
      
      if (stepKey === 'shipped') note = 'Package dispatched from warehouse'
      if (stepKey === 'out for delivery') note = 'Courier partner is delivering today'
      if (stepKey === 'delivered') note = 'Delivered to your location'
      
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

  const { data: existingAdmin } = await supabase.from('users').select('*').eq('email', 'admin@store.com').maybeSingle()
  if (!existingAdmin) {
    await supabase.from('users').insert({
      id: uuidv4(), email: 'admin@store.com', password: hashPw('Admin@123'),
      full_name: 'AK Admin', phone: '+91 83088 60894', role: 'admin', created_at: now,
    })
  }

  const cats = [
    { name: 'Office Stationery', slug: 'office-stationery', description: 'Papers, files, pens, notebooks & printer supplies', image_url: 'https://images.unsplash.com/photo-1568871391150-ff6047a2ff10?w=800&q=80', icon: 'FileText' },
    { name: 'Housekeeping', slug: 'housekeeping', description: 'Cleaning chemicals, tissues, mops & sanitation supplies', image_url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&q=80', icon: 'Sparkles' },
    { name: 'UPS Solutions', slug: 'ups-solutions', description: 'UPS systems, batteries & power backup accessories', image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80', icon: 'BatteryCharging' },
  ].map(c => ({ id: uuidv4(), ...c, created_at: now }))
  
  await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000') 
  await supabase.from('categories').insert(cats)
  const catBy = s => cats.find(c => c.slug === s).id

  const products = [
    { name: 'A4 Copier Paper 75 GSM (500 Sheets)', cat: 'office-stationery', price: 285, mrp: 380, img: ['https://images.unsplash.com/photo-1568871391150-ff6047a2ff10?w=900&q=80'], desc: 'Premium A4 printer & copier paper.', stock: 240, featured: true, subcategory: 'Printing & Copier Paper' },
    { name: 'Lizol Disinfectant Floor Cleaner 5L', cat: 'housekeeping', price: 545, mrp: 720, img: ['https://images.unsplash.com/photo-1585421514738-01798e348b17?w=900&q=80'], desc: 'Kills 99.9% germs. 5L economy pack.', stock: 55, featured: true, subcategory: 'Floor Cleaners' },
    { name: 'APC Home UPS BX600C-IN 600VA', cat: 'ups-solutions', price: 3850, mrp: 4900, img: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=80'], desc: 'APC Back-UPS BX600C-IN 600VA.', stock: 22, featured: true, subcategory: 'UPS Supply' },
  ]
  const productDocs = products.map(p => ({
    id: uuidv4(), name: p.name, slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,''),
    description: p.desc, price: p.price, mrp: p.mrp,
    discount_percent: Math.round((1 - p.price/p.mrp) * 100),
    category_id: catBy(p.cat), subcategory: p.subcategory,
    stock_quantity: p.stock, sku: 'AK-' + Math.floor(Math.random()*90000+10000),
    is_active: true, is_featured: p.featured,
    rating_avg: 4.5, rating_count: 20,
    images: p.img, videos: [], created_at: now, updated_at: now,
  }))
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('products').insert(productDocs)

  const banners = [
    { id: uuidv4(), title: 'Your Trusted B2B Partner', subtitle: 'Office Stationery • Housekeeping • UPS Solutions — all under one roof.', image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1800&q=85', cta_text: 'Browse Catalog', cta_link: '/products', sort_order: 1, is_active: true, created_at: now },
  ]
  await supabase.from('banners').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('banners').insert(banners)

  const clients = [{ id: uuidv4(), name: 'ICICI Lombard GIC', logo_url: '', sort_order: 1, is_active: true }]
  await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('clients').insert(clients)

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
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const supabase = db()
  if (!SUPABASE_URL || !SUPABASE_KEY) return err('Database not configured', 500)
  await ensureSeed()
  
  const p = parts
  const user = await getUser(req)

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
      const dir = path.join(process.cwd(), 'public', 'uploads')
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, filename), buf)
      return json({ url: `/uploads/${filename}`, filename, type: 'image', size: buf.length })
    } catch (e) {
      return err('Upload failed: ' + e.message, 500)
    }
  }

  const body = ['POST','PUT','PATCH'].includes(method) ? await req.json().catch(()=>({})) : {}

  if (p[0] === 'auth') {
    if (p[1] === 'signup' && method === 'POST') {
      const { email, password, full_name, phone } = body
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
      
      const u = { 
        id: newUuid, 
        email, 
        password: hashPw(password), 
        full_name: full_name||'', 
        phone: phone||'', 
        role: 'customer', 
        created_at: nowStr
      }
      
      // 2. Insert into custom public.users table
      const { error: uErr } = await supabase.from('users').insert(u)
      if (uErr) {
        // Rollback auth user creation if public.users insert fails
        await supabase.auth.admin.deleteUser(newUuid)
        return err('Signup failed (users table): ' + uErr.message, 500)
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

      // Self-heal: ensure profiles row exists
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

      const token = sign({ id: u.id, email: u.email, role: u.role, name: u.full_name })
      return json({ token, user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, phone: u.phone } })
    }
    if (p[1] === 'me' && method === 'GET') {
      if (!user) return err('Unauthorized', 401)
      const { data: u } = await supabase.from('users').select('id, email, full_name, phone, role').eq('id', user.id).maybeSingle()
      return json({ user: u })
    }
  }

  if (p[0] === 'categories' && method === 'GET') {
    const { data: cats } = await supabase.from('categories').select('*')
    return json(cats || [], 200, 300)
  }

  if (p[0] === 'products') {
    if (method === 'GET' && !p[1]) {
      let query = supabase.from('products').select('*, product_images(image_url)')
      const category = url.searchParams.get('category')
      const search = url.searchParams.get('search')
      const featured = url.searchParams.get('featured')
      const minPrice = url.searchParams.get('minPrice')
      const maxPrice = url.searchParams.get('maxPrice')
      const sort = url.searchParams.get('sort') || 'newest'
      
      if (category) {
        const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).maybeSingle()
        if (cat) query = query.eq('category_id', cat.id)
      }
      if (search) query = query.ilike('name', `%${search}%`)
      if (featured) query = query.eq('is_featured', true)
      if (minPrice) query = query.gte('price', +minPrice)
      if (maxPrice) query = query.lte('price', +maxPrice)
      
      if (sort === 'price-asc') query = query.order('price', { ascending: true })
      else if (sort === 'price-desc') query = query.order('price', { ascending: false })
      else if (sort === 'popular') query = query.order('rating_count', { ascending: false })
      else query = query.order('created_at', { ascending: false })
      
      const { data: list } = await query
      const listMapped = (list || []).map(p => ({
        ...p,
        images: p.product_images?.map(img => img.image_url) || []
      }))
      return json(listMapped, 200, 120)
    }
    if (method === 'GET' && p[1]) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p[1])
      const query = isUUID
        ? supabase.from('products').select('*, product_images(image_url)').eq('id', p[1])
        : supabase.from('products').select('*, product_images(image_url)').eq('slug', p[1])
      const { data: prod } = await query.maybeSingle()
      if (!prod) return err('Not found', 404)
      const { data: cat } = await supabase.from('categories').select('*').eq('id', prod.category_id).maybeSingle()
      const { data: related } = await supabase.from('products').select('*, product_images(image_url)').eq('category_id', prod.category_id).neq('id', prod.id).limit(4)
      const { data: reviews } = await supabase.from('reviews').select('*').eq('product_id', prod.id).order('created_at', { ascending: false })
      
      const prodMapped = {
        ...prod,
        images: prod.product_images?.map(img => img.image_url) || []
      }
      const relatedMapped = (related || []).map(p => ({
        ...p,
        images: p.product_images?.map(img => img.image_url) || []
      }))
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
      console.log('ORDER PLACEMENT REQUEST FOR USER:', user)
      if (!user) return err('Unauthorized', 401)
      const { items, address, subtotal, shipping_fee, total } = body
      if (!items?.length || !address) return err('Invalid order')
      
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
        status: 'confirmed', // Literal string status to satisfy constraint
        payment_method: body.payment_method || 'COD',
        subtotal,
        discount: body.discount || 0,
        shipping_fee,
        total,
        address_id: addrId,
        placed_at: now,
        created_at: now,
        updated_at: now
      }
      
      const { error: orderErr } = await supabase.from('orders').insert(orderDoc)
      if (orderErr) {
        console.error('Database Order insert error:', orderErr)
        return err('Order database creation failed: ' + orderErr.message, 500)
      }
      
      const itemDocs = items.map(item => ({
        id: uuidv4(),
        order_id: orderId,
        product_id: item.product_id || item.id,
        product_name_snapshot: item.product_name_snapshot || item.name,
        price_snapshot: item.price_snapshot || item.price,
        quantity: item.quantity,
        created_at: now
      }))
      
      const { error: itemsErr } = await supabase.from('order_items').insert(itemDocs)
      if (itemsErr) {
        console.error('Database Order items insert error:', itemsErr)
        return err('Order items database creation failed: ' + itemsErr.message, 500)
      }
      
      // Construct return history
      const trackingData = {
        current: 'confirmed',
        history: [{ status: 'confirmed', timestamp: now, note: 'Order placed successfully' }]
      }
      
      return json({
        ...orderDoc,
        status: 'confirmed',
        status_history: trackingData.history,
        address,
        items
      })
    }
    
    if (method === 'PUT' && p[1]) {
      // Allow user to cancel their own pending/confirmed order
      const { data: orderToUpdate } = await supabase.from('orders').select('id, user_id, status').eq('id', p[1]).maybeSingle()
      const isSelfCancel = user && orderToUpdate?.user_id === user.id && body.status === 'cancelled' && ['pending', 'confirmed'].includes(orderToUpdate?.status)

      if (!isSelfCancel && (!user || user.role !== 'admin')) return err('Forbidden', 403)

      const { error: updErr } = await supabase.from('orders').update({
        status: body.status,
        updated_at: new Date().toISOString()
      }).eq('id', p[1])

      if (updErr) return err('Failed to update order status: ' + updErr.message, 500)
      return json({ ok: true })
    }
  }

  // ==================== COUPONS ====================
  if (p[0] === 'coupons') {
    const supabase = db()

    // POST /api/coupons/validate — validate and calculate discount
    if (method === 'POST' && p[1] === 'validate') {
      const { code, order_total } = body
      if (!code) return err('Coupon code required')
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .maybeSingle()
      if (error) return err('Database error', 500)
      if (!coupon) return err('Invalid coupon code', 404)
      if (!coupon.is_active) return err('This coupon is no longer active', 400)
      if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return err('This coupon has expired', 400)
      if (coupon.min_order_value && order_total < coupon.min_order_value) {
        return err(`Minimum order value of ₹${coupon.min_order_value} required for this coupon`, 400)
      }
      if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
        return err('This coupon has reached its usage limit', 400)
      }

      let discount_amount = 0
      if (coupon.discount_type === 'percent') {
        discount_amount = Math.round((order_total * coupon.discount_value) / 100)
      } else {
        discount_amount = coupon.discount_value
      }
      discount_amount = Math.min(discount_amount, order_total)

      return json({ valid: true, coupon, discount_amount })
    }

    // GET /api/coupons — list coupons (admin only)
    if (method === 'GET') {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
      if (error) return err('Failed to fetch coupons: ' + error.message, 500)
      return json(data || [])
    }

    // POST /api/coupons — create coupon (admin only)
    if (method === 'POST' && !p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const { code, discount_type, discount_value, min_order_value, usage_limit, expiry_date, is_active } = body
      if (!code || !discount_type || !discount_value) return err('Missing required fields')
      const { error } = await supabase.from('coupons').insert({
        id: uuidv4(),
        code: code.toUpperCase().trim(),
        discount_type,
        discount_value: +discount_value,
        min_order_value: +(min_order_value || 0),
        usage_limit: usage_limit ? +usage_limit : null,
        usage_count: 0,
        expiry_date: expiry_date || null,
        is_active: is_active !== false,
        created_at: new Date().toISOString()
      })
      if (error) return err('Failed to create coupon: ' + error.message, 500)
      return json({ ok: true })
    }

    // PUT /api/coupons/[id] — update coupon (admin only)
    if (method === 'PUT' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      const upd = {}
      if (body.is_active !== undefined) upd.is_active = body.is_active
      if (body.discount_value !== undefined) upd.discount_value = +body.discount_value
      if (body.min_order_value !== undefined) upd.min_order_value = +body.min_order_value
      if (body.expiry_date !== undefined) upd.expiry_date = body.expiry_date
      if (body.usage_limit !== undefined) upd.usage_limit = body.usage_limit ? +body.usage_limit : null
      if (body.code !== undefined) upd.code = body.code.toUpperCase().trim()
      const { error } = await supabase.from('coupons').update(upd).eq('id', p[1])
      if (error) return err('Failed to update coupon: ' + error.message, 500)
      return json({ ok: true })
    }

    // DELETE /api/coupons/[id] — delete coupon (admin only)
    if (method === 'DELETE' && p[1]) {
      if (!user || user.role !== 'admin') return err('Forbidden', 403)
      await supabase.from('coupons').delete().eq('id', p[1])
      return json({ ok: true })
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

  return err('Not found', 404)
}

export async function GET(req)    { return route(req, 'GET') }
export async function POST(req)   { return route(req, 'POST') }
export async function PUT(req)    { return route(req, 'PUT') }
export async function DELETE(req) { return route(req, 'DELETE') }
export async function PATCH(req)  { return route(req, 'PATCH') }
