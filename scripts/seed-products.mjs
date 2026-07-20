import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync, existsSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = val
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const now = new Date().toISOString()

// Get category IDs
async function getCategories() {
  const { data } = await supabase.from('categories').select('id, slug, name')
  if (!data || data.length === 0) {
    console.error('No categories found. Run the app first to seed categories.')
    process.exit(1)
  }
  return Object.fromEntries(data.map(c => [c.slug, c.id]))
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').replace(/^-+/, '')
}

// ─── Housekeeping Products ───────────────────────────────────────────────
const housekeepingProducts = [
  { name: 'Green Garbage Bag 29x39 Inches', filename: '29-x-39-green-roll-bag.webp', price: 280, mrp: 350, desc: 'Heavy-duty green garbage bags ideal for office and commercial waste disposal. 29x39 inch size, durable and leak-proof. Pack of 50 bags.', stock: 100, featured: false },
  { name: 'Ala Bleach', filename: 'ala-bkeach.jpg', price: 85, mrp: 110, desc: 'Effective bleaching powder for laundry and surface whitening. Trusted brand for commercial and household cleaning needs.', stock: 60, featured: false },
  { name: 'Ambi Pur Air Freshener', filename: 'ambi-pur-airfreshner.jpg', price: 195, mrp: 245, desc: 'Premium air freshener from Ambi Pur. Long-lasting freshness for office washrooms and reception areas. 275ml spray.', stock: 80, featured: true },
  { name: 'Big Plastic Spoon', filename: 'big-spoon-plastic.png', price: 15, mrp: 25, desc: 'Large plastic serving spoon suitable for canteens and event catering. Food-grade plastic, reusable.', stock: 200, featured: false },
  { name: 'Bottle Cleaning Brush', filename: 'bottle-cleaning-brush.jpeg', price: 35, mrp: 50, desc: 'Flexible bottle cleaning brush with sturdy handle. Reaches bottom of bottles and narrow containers for thorough cleaning.', stock: 150, featured: false },
  { name: 'Check Duster', filename: 'checks-duster.jpg', price: 45, mrp: 65, desc: 'Multi-purpose check-pattern dusting cloth. Lint-free and highly absorbent. Ideal for dusting furniture and surfaces.', stock: 120, featured: false },
  { name: 'Choke Up Pump', filename: 'choke-up-pump.png', price: 180, mrp: 230, desc: 'Effective drain cleaning pump for unclogging kitchen and washroom sinks. Easy to use with strong suction power.', stock: 40, featured: false },
  { name: 'Colin Glass Cleaner 500ml', filename: 'colin-500-ml.webp', price: 95, mrp: 125, desc: 'Streak-free glass and mirror cleaner by Colin. 500ml spray bottle. Ideal for office windows, showroom glass, and mirrors.', stock: 90, featured: true },
  { name: 'Dettol Hand Wash 675ml Pouch', filename: 'dettol-hand-wash-675-ml-pouch.webp', price: 195, mrp: 250, desc: 'Dettol original hand wash liquid in 675ml refill pouch. Kills 99.9% germs. Trusted protection for workplace hygiene.', stock: 75, featured: true },
  { name: 'Dry Mop Frame', filename: 'dry-mob-frame.jpg', price: 220, mrp: 280, desc: 'Sturdy dry mop frame with swivel head for easy maneuverability. Compatible with standard dry mop refill cloths.', stock: 50, featured: false },
  { name: 'Dry Mop Refill 24 Inches', filename: 'dry-mob-refill-24-inchs.jpeg', price: 140, mrp: 180, desc: 'Dry mop refill cloth 24 inch size. Microfiber material traps dust effectively. Washable and reusable.', stock: 80, featured: false },
  { name: 'Dry Mop Refill Cloth 18 Inches', filename: 'dry-mob-rfill-cloth-18-inchs.webp', price: 110, mrp: 145, desc: 'Dry mop refill cloth 18 inch size for smaller mop frames. Microfiber construction for efficient dust capture.', stock: 80, featured: false },
  { name: 'Floor Duster Small', filename: 'floor-duster-small-500x500.webp', price: 160, mrp: 200, desc: 'Compact floor duster for quick daily dusting of office floors. Lightweight and easy to handle.', stock: 60, featured: false },
  { name: 'Godrej Room Freshener', filename: 'godraj-room-freshnar.jpg', price: 145, mrp: 185, desc: 'Godrej aer room freshener for long-lasting fragrance. Ideal for office spaces and washrooms.', stock: 85, featured: false },
  { name: 'Good Home Drainex', filename: 'good-home-drainex-500x500.webp', price: 120, mrp: 155, desc: 'Powerful drain cleaner for clearing clogged kitchen and bathroom drains. Fast-acting formula.', stock: 55, featured: false },
  { name: 'Green Garbage Bags (Small)', filename: 'green-garbage-bags.webp', price: 180, mrp: 230, desc: 'Eco-friendly green garbage bags for general waste disposal. Suitable for office bins. Pack of 100 bags.', stock: 120, featured: false },
  { name: 'Hand Gloves (Rubber)', filename: 'hand-gloves.jpg', price: 65, mrp: 90, desc: 'Durable rubber hand gloves for cleaning and housekeeping tasks. Protects hands from chemicals and dirt.', stock: 100, featured: false },
  { name: 'Harpic Toilet Cleaner 500ml', filename: 'harpic-500-ml.webp', price: 110, mrp: 145, desc: 'Original Harpic toilet cleaner 500ml. Removes stains and kills germs. Thick liquid formula clings to bowl surface.', stock: 95, featured: true },
  { name: 'Hit Black + Red Insect Killer', filename: 'hit-black-red-500x500.webp', price: 175, mrp: 225, desc: 'Dual-action insect killer spray. Kills cockroaches, mosquitoes, flies and crawling insects. 500ml can.', stock: 70, featured: false },
  { name: 'Lizol Floor Cleaner 1 Litre', filename: 'lizol-1-ltr.webp', price: 215, mrp: 275, desc: 'Lizol disinfectant floor cleaner 1 litre. Kills 99.9% germs. Leaves floors clean and fragrant.', stock: 90, featured: true },
  { name: 'Lizol Floor Cleaner 500ml', filename: 'lizol-500-ml.webp', price: 125, mrp: 160, desc: 'Lizol disinfectant floor cleaner 500ml. Effective against household germs. Suitable for all floor types.', stock: 100, featured: false },
  { name: 'M Gild Tissue Paper', filename: 'm-gild-tissu-paper.webp', price: 95, mrp: 130, desc: 'Soft and absorbent tissue paper by M Gild. Ideal for office pantries and washrooms. Bulk pack.', stock: 200, featured: false },
  { name: 'M-Fold Tissue Paper', filename: 'm-fold-tissue.webp', price: 165, mrp: 210, desc: 'Premium M-fold interfold tissue paper for commercial dispensers. High absorbency, 2-ply quality.', stock: 150, featured: true },
  { name: 'Metal Dustbin', filename: 'metal-dustbin.jpg', price: 450, mrp: 580, desc: 'Sturdy metal dustbin with foot pedal. Rust-resistant finish. Ideal for office reception and workstations.', stock: 35, featured: false },
  { name: 'Odonil Room Freshener', filename: 'odonil-room-freshener.webp', price: 85, mrp: 110, desc: 'Odonil room freshener block for continuous fragrance. Perfect for washrooms and small office spaces.', stock: 100, featured: false },
  { name: 'Ozone Floor Cleaner 1 Litre', filename: 'ozone-floor-cleaner-1-ltr.jpg', price: 180, mrp: 230, desc: 'Ozone disinfectant floor cleaner 1 litre. Effective cleaning with a pleasant fragrance. Suitable for mopping all floor types.', stock: 70, featured: false },
  { name: 'Plastic Hard Broom', filename: 'plastic-hard-broom.webp', price: 95, mrp: 130, desc: 'Durable plastic hard broom for outdoor and rough surfaces. Sturdy bristles for effective sweeping.', stock: 60, featured: false },
  { name: 'Plastic Spoon Small', filename: 'plastic-spoon-small.jpeg', price: 8, mrp: 15, desc: 'Small plastic spoon for office pantry and events. Food-grade material. Disposable and hygienic.', stock: 500, featured: false },
  { name: 'Sanicube 200 GM', filename: 'sanicube-200-gm.jpg', price: 95, mrp: 130, desc: 'Sanitary urinal cube 200 GM for washroom freshness. Long-lasting fragrance and cleaning action.', stock: 120, featured: false },
  { name: 'Scotch-Brite Big Scrubber', filename: 'scothbrite-big.jpg', price: 65, mrp: 90, desc: 'Large Scotch-Brite scrub pad for heavy-duty kitchen and surface cleaning. Durable and long-lasting.', stock: 100, featured: false },
  { name: 'Soft Broom', filename: 'soft-broom.jpg', price: 85, mrp: 115, desc: 'Soft bristle broom for indoor use. Ideal for dusting and sweeping office floors without scratching.', stock: 65, featured: false },
  { name: 'Steel Spoon (Large)', filename: 'steel-spoon.webp', price: 25, mrp: 40, desc: 'Large stainless steel serving spoon for canteen and kitchen use. Rust-resistant and durable.', stock: 150, featured: false },
  { name: 'Sunny Cube 400 GM', filename: 'sunny-cube-400-gm.jpg', price: 135, mrp: 175, desc: 'Sunny brand urinal cube 400 GM for effective washroom odor control and cleaning.', stock: 100, featured: false },
  { name: 'Sunny Phenyl 1 Litre', filename: 'sunny-phenyl-1ltr.webp', price: 110, mrp: 145, desc: 'Sunny phenyl disinfectant 1 litre for floor cleaning. Strong fragrance. Kills germs effectively.', stock: 80, featured: false },
  { name: 'Toilet Brush', filename: 'toilet-brush.webp', price: 65, mrp: 90, desc: 'Toilet brush with ergonomic handle and sturdy bristles. Ideal for office and commercial washroom cleaning.', stock: 75, featured: false },
  { name: 'Toilet Roll (Jumbo)', filename: 'toilet-roll.jpg', price: 140, mrp: 180, desc: 'Jumbo toilet roll for commercial dispensers. High sheet count. Soft and absorbent 2-ply paper.', stock: 200, featured: true },
  { name: 'Ultra Soft Tissue Napkin 40x40', filename: 'ultra-soft-tissue-napkin-40x40.jpeg', price: 155, mrp: 200, desc: 'Ultra soft tissue napkin 40x40 cm for dining and pantry use. Highly absorbent and lint-free.', stock: 180, featured: false },
  { name: 'Vim Bar Big', filename: 'vimbar-big.jpg', price: 45, mrp: 65, desc: 'Vim bar - large size. Effective dish and surface cleaning bar. Removes grease and tough stains.', stock: 100, featured: false },
  { name: 'Vim Bar Small', filename: 'vimbar-small.jpg', price: 25, mrp: 35, desc: 'Vim dish cleaning bar - small size. Ideal for kitchen and utensil cleaning. Lemon fresh variant.', stock: 150, featured: false },
  { name: 'Wet Mop Clip', filename: 'wet-mob-clip.png', price: 50, mrp: 70, desc: 'Wet mop clip for securing mop cloth. Easy to attach and replace. Compatible with standard mop handles.', stock: 80, featured: false },
  { name: 'Wet Mop Refill 250 GM', filename: 'wet-mob-refill-250.jpg', price: 90, mrp: 120, desc: 'Wet mop refill 250 GM cotton yarn. Highly absorbent for wet mopping. Fits standard mop frames.', stock: 90, featured: false },
  { name: 'Wheel Powder Detergent', filename: 'wheel-powdar.jpg', price: 75, mrp: 100, desc: 'Wheel laundry detergent powder. Effective cleaning for white and colored clothes. 500g pack.', stock: 100, featured: false },
  { name: 'Yellow Duster', filename: 'yello-duster.jpg', price: 35, mrp: 50, desc: 'Soft yellow duster cloth for dusting. Lint-free and washable. Ideal for furniture and electronics.', stock: 120, featured: false },
]

// ─── Stationery Products ──────────────────────────────────────────────────
const stationeryProducts = [
  { name: 'Apsara HB Pencil Pack', filename: 'apsara-hb-pencil.jpg', price: 25, mrp: 36, desc: 'Apsara HB pencils, pack of 10. Premium quality writing pencils with smooth lead. Perfect for office and school use.', stock: 200, featured: true },
  { name: 'Camlin Permanent Marker', filename: 'camlin-permanent-maker.jpeg', price: 35, mrp: 50, desc: 'Camlin permanent marker with bold tip. Water-resistant and quick-drying ink. Ideal for labeling and marking.', stock: 150, featured: false },
  { name: 'Drawing Pins (Board Pins)', filename: 'drawing-pins.webp', price: 15, mrp: 25, desc: 'High-quality drawing pins / board pins for notice boards. Pack of 50. Rust-resistant steel pins.', stock: 300, featured: false },
  { name: 'Laxi Ball Pen', filename: 'laxi-ball-pen.jpg', price: 12, mrp: 20, desc: 'Laxi ball pen with smooth ink flow. Comfortable grip. Ideal for everyday office writing. Blue ink.', stock: 250, featured: false },
  { name: 'Natraj Eraser', filename: 'nataraj-eraser.jpg', price: 8, mrp: 15, desc: 'Natraj premium eraser. Soft PVC material that erases cleanly without smudging or tearing paper.', stock: 300, featured: false },
  { name: 'Natraj Sharpener', filename: 'natraj-sharpner.webp', price: 10, mrp: 18, desc: 'Natraj pencil sharpener with durable metal blade. Compact design with shavings collector.', stock: 300, featured: false },
  { name: 'Paper Clip 35mm (Rolex)', filename: 'paper-clip-35-mm-rolex-1x10.jpg', price: 30, mrp: 45, desc: 'Rolex brand paper clips 35mm size. Pack of 10 boxes (100 clips each). Zinc-plated, rust-resistant.', stock: 200, featured: false },
  { name: 'Pik Sketch Pen Set', filename: 'pik-sketch-pen-set.jpeg', price: 85, mrp: 120, desc: 'Pik sketch pen set with assorted vibrant colors. Perfect for office presentations and creative work.', stock: 100, featured: false },
  { name: 'Pink Highlighter', filename: 'pink-highlighter.jpg', price: 15, mrp: 25, desc: 'Bright pink fluorescent highlighter. Chisel tip for broad and fine highlighting. Water-based ink.', stock: 180, featured: false },
  { name: 'Stapler Machine HD 45 (Kangaroo)', filename: 'stapler-machine-hd-45-kangaroo.jpg', price: 285, mrp: 360, desc: 'Kangaroo HD 45 heavy-duty stapler. Staples up to 45 sheets. Ergonomic design for office use.', stock: 40, featured: true },
  { name: 'Stapler Machine HP 45 (Kangaroo)', filename: 'stapler-machine-hp-45-kangaroo.webp', price: 260, mrp: 330, desc: 'Kangaroo HP 45 standard stapler for office use. Staples up to 20 sheets. Durable metal construction.', stock: 50, featured: false },
  { name: 'Stapler Machine No. 10 (Kangaroo)', filename: 'stapler-machine-no-10-kangaroo.jpeg', price: 165, mrp: 210, desc: 'Kangaroo No. 10 mini stapler for light stapling needs. Compact size for desk or carry.', stock: 60, featured: false },
  { name: 'Stapler Pin 23x17 (Kangaroo)', filename: 'stapler-pin-23-x17-kangaroo.jpg', price: 55, mrp: 75, desc: 'Kangaroo 23x17 mm standard stapler pins. Box of 1000 pins. Compatible with most standard staplers.', stock: 150, featured: false },
  { name: 'Stapler Pin 24x6 (Kangaroo)', filename: 'stapler-pin-24-x6-kangaroo.webp', price: 60, mrp: 80, desc: 'Kangaroo 24x6 mm heavy-duty stapler pins. Box of 1000 pins. For HD staplers and thick bundles.', stock: 150, featured: false },
  { name: 'Stapler Pin No. 10 (Kangaroo)', filename: 'stapler-pin-no-10-kangroo.webp', price: 40, mrp: 55, desc: 'Kangaroo No. 10 mini stapler pins. Box of 1000 pins. Compatible with No.10 mini staplers.', stock: 150, featured: false },
  { name: 'U-Shaped Paper Clip', filename: 'u-shaped-paper-clip.jpg', price: 20, mrp: 30, desc: 'U-shaped paper clips for securing document bundles. Pack of 50. Strong grip without damaging paper.', stock: 200, featured: false },
  { name: 'Writing Pad Ruled (A4)', filename: 'writing-pad-ruled.jpg', price: 65, mrp: 85, desc: 'A4 ruled writing pad with 60 pages. Quality paper for smooth writing. Ideal for office notes.', stock: 100, featured: false },
  { name: 'Writing Pad (Small)', filename: 'writing-pad-1-150x150.webp', price: 40, mrp: 55, desc: 'Compact ruled writing pad, perfect for quick notes and memos. 40 pages. Pocket-friendly size.', stock: 120, featured: false },
]

async function seed() {
  console.log('Fetching categories...')
  const cats = await getCategories()
  const hkCatId = cats['housekeeping']
  const stationaryCatId = cats['office-stationery']

  if (!hkCatId || !stationaryCatId) {
    console.error('Could not find required categories')
    process.exit(1)
  }

  console.log(`Housekeeping ID: ${hkCatId}`)
  console.log(`Stationery ID: ${stationaryCatId}`)

  // Clear existing product images and products
  console.log('\nClearing existing product images and products...')
  await supabase.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const uploadedCache = {}

  async function uploadImage(filename) {
    if (!filename) return '/placeholder.png'
    if (uploadedCache[filename]) return uploadedCache[filename]

    const fullPath = path.join(UPLOADS_DIR, filename)
    if (existsSync(fullPath)) {
      const buf = readFileSync(fullPath)
      const ext = filename.split('.').pop() || 'bin'
      const storageFilename = `${uuidv4()}.${ext}`

      const contentTypeMap = {
        webp: 'image/webp',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
      }

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(storageFilename, buf, {
          contentType: contentTypeMap[ext] || `image/${ext}`,
          cacheControl: '31536000'
        })

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(storageFilename)
        uploadedCache[filename] = publicUrl
        console.log(`Uploaded ${filename} -> ${publicUrl}`)
        return publicUrl
      } else {
        console.error(`Failed to upload ${filename}:`, uploadErr.message)
        return `/uploads/${filename}`
      }
    } else {
      console.warn(`Local file ${filename} not found in ${UPLOADS_DIR}`)
      return `/uploads/${filename}`
    }
  }

  // Insert housekeeping products
  console.log(`\nInserting ${housekeepingProducts.length} housekeeping products...`)
  for (const p of housekeepingProducts) {
    const publicUrl = await uploadImage(p.filename)
    const pId = uuidv4()
    const doc = {
      id: pId,
      name: p.name,
      slug: slugify(p.name),
      description: p.desc,
      price: p.price,
      mrp: p.mrp,
      discount_percent: Math.round((1 - p.price / p.mrp) * 100),
      category_id: hkCatId,
      subcategory: 'Housekeeping Supplies',
      stock_quantity: p.stock,
      sku: 'AK-HK-' + Math.floor(Math.random() * 90000 + 10000),
      is_active: true,
      is_featured: p.featured,
      rating_avg: 4.5,
      rating_count: 15,
      images: [publicUrl],
      videos: [],
      created_at: now,
      updated_at: now,
    }
    await supabase.from('products').insert(doc)
    await supabase.from('product_images').insert({
      id: uuidv4(),
      product_id: pId,
      image_url: publicUrl,
      sort_order: 0,
      created_at: now
    })
    console.log(`  ✓ ${p.name}`)
  }

  // Insert stationery products
  console.log(`\nInserting ${stationeryProducts.length} stationery products...`)
  for (const p of stationeryProducts) {
    const publicUrl = await uploadImage(p.filename)
    const pId = uuidv4()
    const doc = {
      id: pId,
      name: p.name,
      slug: slugify(p.name),
      description: p.desc,
      price: p.price,
      mrp: p.mrp,
      discount_percent: Math.round((1 - p.price / p.mrp) * 100),
      category_id: stationaryCatId,
      subcategory: 'Office Stationery',
      stock_quantity: p.stock,
      sku: 'AK-ST-' + Math.floor(Math.random() * 90000 + 10000),
      is_active: true,
      is_featured: p.featured,
      rating_avg: 4.3,
      rating_count: 12,
      images: [publicUrl],
      videos: [],
      created_at: now,
      updated_at: now,
    }
    await supabase.from('products').insert(doc)
    await supabase.from('product_images').insert({
      id: uuidv4(),
      product_id: pId,
      image_url: publicUrl,
      sort_order: 0,
      created_at: now
    })
    console.log(`  ✓ ${p.name}`)
  }

  console.log(`\n✅ Done! ${housekeepingProducts.length + stationeryProducts.length} products inserted.`)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
