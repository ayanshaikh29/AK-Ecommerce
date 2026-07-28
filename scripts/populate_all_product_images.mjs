import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

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

const hkDir = path.join(process.cwd(), 'Hk folder', 'Hk folder')
const statDir = path.join(process.cwd(), 'stationary', 'stationary')
const uploadsDir = path.join(process.cwd(), 'public', 'uploads')

// Exact, verified 1:1 mapping for all 61 products in the database
const exactMapping = {
  // Housekeeping Products
  "Ala Bleach 500ml": { dir: hkDir, file: "Ala Bkeach.jpg", fallbackUpload: "ala-bleach-500ml.webp" },
  "Ambi Pur Air Freshener": { dir: hkDir, file: "Ambi Pur Airfreshner.jpg", fallbackUpload: "ambi-pur-air-freshener.webp" },
  "Big Plastic Spoon": { dir: hkDir, file: "Big-Spoon-plastic.png", fallbackUpload: "big-plastic-spoon.webp" },
  "Bottle Cleaning Brush": { dir: hkDir, file: "Bottle-Cleaning-Brush.jpeg", fallbackUpload: "bottle-cleaning-brush.webp" },
  "Checks Duster Cloth": { dir: hkDir, file: "Checks Duster.jpg", fallbackUpload: "checks-duster-cloth.webp" },
  "Colin Glass Cleaner 500ml": { dir: hkDir, file: "colin 500 ml.webp", fallbackUpload: "colin-glass-cleaner-500ml.webp" },
  "Dettol Liquid Hand Wash Pouch 675ml": { dir: hkDir, file: "Dettol Hand wash 675 ml pouch.webp", fallbackUpload: "dettol-liquid-hand-wash-pouch-675ml.webp" },
  "Drain Choke Up Pump": { dir: hkDir, file: "Choke up pump.png", fallbackUpload: "drain-choke-up-pump.webp" },
  "Dry Mop Frame": { dir: hkDir, file: "dry mob frame.jpg", fallbackUpload: "dry-mop-frame.webp" },
  "Dry Mop Refill 18 Inches": { dir: hkDir, file: "dry mob rfill cloth 18 inchs.webp", fallbackUpload: "dry-mop-refill-18-inches.webp" },
  "Dry Mop Refill 24 Inches": { dir: hkDir, file: "dry mob refill 24 inchs.jpeg", fallbackUpload: "dry-mop-refill-24-inches.webp" },
  "Floor Duster Small": { dir: hkDir, file: "floor-duster-small-500x500.webp", fallbackUpload: "floor-duster-small.webp" },
  "Godrej Aer Room Freshener": { dir: hkDir, file: "Godraj room freshnar.jpg", fallbackUpload: "godrej-aer-room-freshener.webp" },
  "Good Home Drainex 50g": { dir: hkDir, file: "good-home-drainex-500x500.webp", fallbackUpload: "good-home-drainex-50g.webp" },
  "Green Garbage Bag 29x39 Inches": { dir: hkDir, file: "29-x-39-green-roll- bag.webp", fallbackUpload: "green-garbage-bag-29x39-inches.webp" },
  "Green Garbage Bags Pack": { dir: hkDir, file: "green garbage bags.webp", fallbackUpload: "green-garbage-bags-pack.webp" },
  "Harpic Toilet Cleaner 500ml": { dir: hkDir, file: "harpic 500 ml.webp", fallbackUpload: "harpic-toilet-cleaner-500ml.webp" },
  "Hit Black + Red Insect Killer": { dir: hkDir, file: "hit-black-red-500x500.webp", fallbackUpload: "hit-black-red-insect-killer.webp" },
  "Jumbo Toilet Roll": { dir: hkDir, file: "toilet roll.jpg", fallbackUpload: "jumbo-toilet-roll.webp" },
  "Lizol Floor Cleaner 1 Litre": { dir: hkDir, file: "lizol 1 ltr.webp", fallbackUpload: "lizol-floor-cleaner-1-litre.webp" },
  "Lizol Floor Cleaner 500ml": { dir: hkDir, file: "lizol 500 ml.webp", fallbackUpload: "lizol-floor-cleaner-500ml.webp" },
  "M Gild Tissue Paper Box": { dir: hkDir, file: "m gild tissu paper.webp", fallbackUpload: "m-gild-tissue-paper-box.webp" },
  "M-Fold Paper Tissues": { dir: hkDir, file: "m-fold-tissue.webp", fallbackUpload: "m-fold-paper-tissues.webp" },
  "Metal Mesh Dustbin": { dir: hkDir, file: "metal dustbin.jpg", fallbackUpload: "metal-mesh-dustbin.webp" },
  "Odonil Air Freshener Block": { dir: hkDir, file: "odonil-room-freshener.webp", fallbackUpload: "odonil-air-freshener-block.webp" },
  "Ozone Floor Cleaner 1 Litre": { dir: hkDir, file: "ozone-floor-cleaner 1 ltr.jpg", fallbackUpload: "ozone-floor-cleaner-1-litre.webp" },
  "Plastic Hard Broom": { dir: hkDir, file: "Plastic Hard Broom.webp", fallbackUpload: "plastic-hard-broom.webp" },
  "Rubber Hand Gloves": { dir: hkDir, file: "Hand Gloves.jpg", fallbackUpload: "rubber-hand-gloves.webp" },
  "Sanicube Urinal Cubes 200g": { dir: hkDir, file: "Sanicube 200 Gm.jpg", fallbackUpload: "sanicube-urinal-cubes-200g.webp" },
  "Scotch-Brite Big Scrubber": { dir: hkDir, file: "Scothbrite Big.jpg", fallbackUpload: "scotch-brite-big-scrubber.webp" },
  "Small Plastic Spoon": { dir: hkDir, file: "Plastic Spoon Small.jpeg", fallbackUpload: "small-plastic-spoon.webp" },
  "Soft Broom (Phool Jhadu)": { dir: hkDir, file: "soft-broom.jpg", fallbackUpload: "soft-broom-phool-jhadu.webp" },
  "Steel Spoon": { dir: hkDir, file: "Steel Spoon.webp", fallbackUpload: "steel-spoon.webp" },
  "Sunny Phenyl 1 Litre": { dir: hkDir, file: "sunny phenyl 1ltr.webp", fallbackUpload: "sunny-phenyl-1-litre.webp" },
  "Sunny Urinal Cubes 400g": { dir: hkDir, file: "Sunny Cube 400 GM.jpg", fallbackUpload: "sunny-urinal-cubes-400g.webp" },
  "Toilet Cleaning Brush": { dir: hkDir, file: "Toilet brush.webp", fallbackUpload: "toilet-cleaning-brush.webp" },
  "Ultra Soft Tissue Napkin 40x40cm": { dir: hkDir, file: "ultra-soft-tissue-napkin-40x40.jpeg", fallbackUpload: "ultra-soft-tissue-napkin-40x40cm.webp" },
  "Vim Dishwash Bar Large": { dir: hkDir, file: "vimbar big.jpg", fallbackUpload: "vim-dishwash-bar-large.webp" },
  "Vim Dishwash Bar Small": { dir: hkDir, file: "vimbar small.jpg", fallbackUpload: "vim-dishwash-bar-small.webp" },
  "Wet Mop Clip and Holder": { dir: hkDir, file: "wet mob clip.png", fallbackUpload: "wet-mop-clip-and-holder.webp" },
  "Wet Mop Refill 250g": { dir: hkDir, file: "wet mob refill 250.jpg", fallbackUpload: "wet-mop-refill-250g.webp" },
  "Wheel Active Detergent Powder": { dir: hkDir, file: "wheel powdar.jpg", fallbackUpload: "wheel-active-detergent-powder.webp" },
  "Yellow Duster Cloth": { dir: hkDir, file: "Yello Duster.jpg", fallbackUpload: "yellow-duster-cloth.webp" },

  // Office Stationery Products
  "A4 Ruled Writing Pad": { dir: statDir, file: "Writing pad Ruled - Copy.jpg", fallbackUpload: "a4-ruled-writing-pad.webp" },
  "Apsara HB Pencil Pack": { dir: statDir, file: "Apsara HB Pencil - Copy (2).jpg", fallbackUpload: "apsara-hb-pencil-pack.webp" },
  "Camlin Permanent Marker": { dir: statDir, file: "Camlin Permanent Maker - Copy (2).jpeg", fallbackUpload: "camlin-permanent-marker.webp" },
  "Drawing Pins Board Pins": { dir: statDir, file: "Drawing Pins (Bord) - Copy - Copy.webp", fallbackUpload: "drawing-pins-board-pins.webp" },
  "Fluorescent Pink Highlighter": { dir: statDir, file: "Pink Highlighter - Copy.jpg", fallbackUpload: "fluorescent-pink-highlighter.webp" },
  "Kangaroo 23x17 Stapler Pins": { dir: statDir, file: "Stapler Pin - 23 X17 Kangaroo - Copy.jpg", fallbackUpload: "kangaroo-23x17-stapler-pins.webp" },
  "Kangaroo 24x6 Stapler Pins": { dir: statDir, file: "Stapler Pin - 24 X6 Kangaroo - Copy.webp", fallbackUpload: "kangaroo-24x6-stapler-pins.webp" },
  "Kangaroo HD-45 Stapler": { dir: statDir, file: "Stapler Machine - HD 45 Kangaroo - Copy.jpg", fallbackUpload: "kangaroo-hd-45-stapler.webp" },
  "Kangaroo HP-45 Plier Stapler": { dir: statDir, file: "Stapler Machine - HP 45 kangaroo - Copy.webp", fallbackUpload: "kangaroo-hp-45-plier-stapler.webp" },
  "Kangaroo No. 10 Stapler": { dir: statDir, file: "Stapler Machine - No .10 Kangaroo - Copy.jpeg", fallbackUpload: "kangaroo-no-10-stapler.webp" },
  "Kangaroo No. 10 Stapler Pins": { dir: statDir, file: "Stapler Pin - No 10. Kangroo - Copy.webp", fallbackUpload: "kangaroo-no-10-stapler-pins.webp" },
  "Laxi Ball Pen Blue": { dir: statDir, file: "Laxi Ball Pen - Copy - Copy.jpg", fallbackUpload: "laxi-ball-pen-blue.webp" },
  "Natraj Pencil Sharpener": { dir: statDir, file: "Natraj sharpner - Copy.webp", fallbackUpload: "natraj-pencil-sharpener.webp" },
  "Natraj Premium Eraser": { dir: statDir, file: "Natraj eraser - Copy (2).webp", fallbackUpload: "natraj-premium-eraser.webp" },
  "Pik Sketch Pen Set 12 Colors": { dir: statDir, file: "Pik Sketch Pen Set - Copy.jpeg", fallbackUpload: "pik-sketch-pen-set-12-colors.webp" },
  "Rolex Paper Clips 35mm": { dir: statDir, file: "Paper Clip -35 mm Rolex 1x10 - Copy.jpg", fallbackUpload: "rolex-paper-clips-35mm.webp" },
  "Small Ruled Notepad": { dir: statDir, file: "writing-pad-1-150x150 - Copy.webp", fallbackUpload: "small-ruled-notepad.webp" },
  "U-Shaped Metal Paper Clips": { dir: statDir, file: "u-shaped-paper-clip - Copy.jpg", fallbackUpload: "u-shaped-metal-paper-clips.webp" }
}

async function run() {
  console.log('=== POPULATING ALL 61 PRODUCT IMAGES ===\n')

  // Create bucket if needed
  try {
    await supabase.storage.createBucket('product-images', { public: true })
  } catch (e) {}

  const { data: products } = await supabase.from('products').select('id, name')
  if (!products) {
    console.error('No products found')
    return
  }

  let updatedCount = 0
  let unmappedList = []

  for (const p of products) {
    const config = exactMapping[p.name]
    let imageFilePath = null
    let filename = null

    if (config) {
      const fullP = path.join(config.dir, config.file)
      if (fs.existsSync(fullP)) {
        imageFilePath = fullP
        filename = config.file
      } else if (config.fallbackUpload) {
        const fallP = path.join(uploadsDir, config.fallbackUpload)
        if (fs.existsSync(fallP)) {
          imageFilePath = fallP
          filename = config.fallbackUpload
        }
      }
    }

    if (!imageFilePath) {
      console.log(`⚠️ NO EXACT FILE FOUND FOR: "${p.name}" - Using placeholder`)
      unmappedList.push(p.name)
      const placeholderUrl = '/placeholder-product.png'
      await supabase.from('products').update({ images: [placeholderUrl] }).eq('id', p.id)
      continue
    }

    // Ensure image is also copied into public/uploads with clean name
    const ext = path.extname(filename)
    const cleanSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    const cleanUploadName = `${cleanSlug}${ext}`
    const destUploadPath = path.join(uploadsDir, cleanUploadName)
    
    fs.copyFileSync(imageFilePath, destUploadPath)
    const localUrl = `/uploads/${cleanUploadName}`

    // Upload to Supabase Storage
    let publicUrl = localUrl
    try {
      const buf = fs.readFileSync(imageFilePath)
      const storagePath = `products/${cleanUploadName}`
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(storagePath, buf, { contentType, upsert: true })

      if (!upErr) {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath)
        if (urlData?.publicUrl) {
          publicUrl = urlData.publicUrl
        }
      }
    } catch (e) {
      console.warn(`Storage upload warning for ${p.name}:`, e.message)
    }

    // Clear old product_images entries and insert new clean entry
    await supabase.from('product_images').delete().eq('product_id', p.id)
    
    const { error: piErr } = await supabase.from('product_images').insert({
      id: uuidv4(),
      product_id: p.id,
      image_url: publicUrl,
      sort_order: 0,
      created_at: new Date().toISOString()
    })

    if (piErr) {
      console.error(`Error inserting product_images for ${p.name}:`, piErr.message)
    }

    // Update products table images array
    const { error: pErr } = await supabase.from('products').update({
      images: [publicUrl],
      updated_at: new Date().toISOString()
    }).eq('id', p.id)

    if (pErr) {
      console.error(`Error updating product ${p.name}:`, pErr.message)
    } else {
      updatedCount++
      console.log(`✓ UPDATED (${updatedCount}/61): "${p.name}" -> ${publicUrl}`)
    }
  }

  console.log(`\n==============================================`)
  console.log(`TOTAL PRODUCTS PROCESSED: ${products.length}`)
  console.log(`SUCCESSFULLY VERIFIED & UPDATED: ${updatedCount}`)
  console.log(`PRODUCTS NEEDING MANUAL IMAGE: ${unmappedList.length}`)
  if (unmappedList.length > 0) {
    unmappedList.forEach(item => console.log(` - ${item}`))
  }
  console.log(`==============================================`)
}

run()
