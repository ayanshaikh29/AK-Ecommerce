import os
import json
import re
from PIL import Image

# Directories
WORKSPACE = "c:/Users/HP/Desktop/Portfolios Ayan/E-COMMERCE WEB/ak-enterprises-website"
HK_SRC = os.path.join(WORKSPACE, "Hk folder/Hk folder")
ST_SRC = os.path.join(WORKSPACE, "stationary/stationary")
DEST_DIR = os.path.join(WORKSPACE, "public/uploads")

# Ensure destination exists
os.makedirs(DEST_DIR, exist_ok=True)

# Product metadata mapping based on original filenames
HK_MAPPING = {
    "29-x-39-green-roll- bag.webp": {
        "name": "Green Garbage Bag 29x39 Inches",
        "brand": None,
        "price": 280,
        "mrp": 350,
        "desc": "Heavy-duty green garbage bags on roll. Size 29x39 inches. Perfect for large commercial or office bins. Durable, leak-proof, and easy to detach.",
        "subcategory": "Garbage Bags",
        "featured": False
    },
    "Ala Bkeach.jpg": {
        "name": "Ala Bleach 500ml",
        "brand": "Ala",
        "price": 85,
        "mrp": 110,
        "desc": "Powerful liquid bleach for superior whitening of clothes and disinfection of surfaces. Trusted brand for household and commercial laundry needs.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "Ambi Pur Airfreshner.jpg": {
        "name": "Ambi Pur Air Freshener",
        "brand": "Ambi Pur",
        "price": 195,
        "mrp": 245,
        "desc": "Premium spray air freshener that eliminates odors and leaves a refreshing scent. Perfect for office reception, conference rooms, and washrooms.",
        "subcategory": "Air Fresheners",
        "featured": True
    },
    "Big-Spoon-plastic.png": {
        "name": "Big Plastic Spoon",
        "brand": None,
        "price": 15,
        "mrp": 25,
        "desc": "Large food-grade disposable plastic spoon, ideal for corporate catering, office cafeterias, and events. Durable build.",
        "subcategory": "Disposables",
        "featured": False
    },
    "Bottle-Cleaning-Brush.jpeg": {
        "name": "Bottle Cleaning Brush",
        "brand": None,
        "price": 35,
        "mrp": 50,
        "desc": "Durable bottle cleaning brush with stiff nylon bristles and a flexible handle. Reaches the bottom of bottles and flasks easily.",
        "subcategory": "Cleaning Tools",
        "featured": False
    },
    "Checks Duster.webp": {
        "name": "Checks Duster Cloth",
        "brand": None,
        "price": 45,
        "mrp": 65,
        "desc": "High-quality check pattern cotton dusting cloth. Highly absorbent, lint-free, and ideal for cleaning glass, furniture, and office desks.",
        "subcategory": "Dusters",
        "featured": False
    },
    "Choke up pump.png": {
        "name": "Drain Choke Up Pump",
        "brand": None,
        "price": 180,
        "mrp": 230,
        "desc": "Heavy-duty manual sink plunger and choke-up pump. Easy to use with strong suction to clear clogged pipes in office pantries and washrooms.",
        "subcategory": "Sanitation Tools",
        "featured": False
    },
    "Dettol Hand wash 675 ml pouch.webp": {
        "name": "Dettol Liquid Hand Wash Pouch 675ml",
        "brand": "Dettol",
        "price": 195,
        "mrp": 250,
        "desc": "Dettol Liquid Hand Wash refill pouch. Kills 99.9% of germs. Trusted protection for workplace hygiene with a fresh scent.",
        "subcategory": "Hand Wash",
        "featured": True
    },
    "Godraj room freshnar.jpg": {
        "name": "Godrej Aer Room Freshener",
        "brand": "Godrej",
        "price": 145,
        "mrp": 185,
        "desc": "Godrej Aer room freshener spray. Features a long-lasting fragrance that instantly brightens up office spaces and washrooms.",
        "subcategory": "Air Fresheners",
        "featured": False
    },
    "Hand Gloves.jpg": {
        "name": "Rubber Hand Gloves",
        "brand": None,
        "price": 65,
        "mrp": 90,
        "desc": "Durable rubber hand gloves for cleaning, mopping, and handling chemicals. Protects hands from harsh substances. Size: Medium.",
        "subcategory": "Safety Wear",
        "featured": False
    },
    "Plastic Hard Broom.webp": {
        "name": "Plastic Hard Broom",
        "brand": None,
        "price": 95,
        "mrp": 130,
        "desc": "Sturdy plastic hard broom with strong bristles. Ideal for outdoor sweeping, wet floors, and rough cleaning tasks.",
        "subcategory": "Brooms",
        "featured": False
    },
    "Plastic Spoon Small.jpeg": {
        "name": "Small Plastic Spoon",
        "brand": None,
        "price": 8,
        "mrp": 15,
        "desc": "Small disposable plastic spoon, food-grade quality. Convenient for tea, coffee, and daily use in office canteens. Pack of 100.",
        "subcategory": "Disposables",
        "featured": False
    },
    "Sanicube 200 Gm.jpg": {
        "name": "Sanicube Urinal Cubes 200g",
        "brand": "Sanicube",
        "price": 95,
        "mrp": 130,
        "desc": "Urinal sanitizer cubes for washroom freshness. Controls odors and maintains hygiene. Net weight 200g.",
        "subcategory": "Sanitation",
        "featured": False
    },
    "Scothbrite Big.jpg": {
        "name": "Scotch-Brite Big Scrubber",
        "brand": "Scotch-Brite",
        "price": 65,
        "mrp": 90,
        "desc": "Large heavy-duty green scrub pad by 3M Scotch-Brite. Excellent for cleaning kitchen utensils, pots, and pantry sinks.",
        "subcategory": "Cleaning Tools",
        "featured": False
    },
    "Steel Spoon.webp": {
        "name": "Steel Spoon",
        "brand": None,
        "price": 25,
        "mrp": 40,
        "desc": "Premium stainless steel spoon for daily office pantry use. Rust-resistant, food-safe, and highly durable.",
        "subcategory": "Pantry Items",
        "featured": False
    },
    "Sunny Cube 400 GM.jpg": {
        "name": "Sunny Urinal Cubes 400g",
        "brand": "Sunny",
        "price": 135,
        "mrp": 175,
        "desc": "Sunny brand urinal deodorant cubes. Heavy-duty 400g pack. Ensures continuous fresh scent and controls odors in office toilets.",
        "subcategory": "Sanitation",
        "featured": False
    },
    "Toilet brush.webp": {
        "name": "Toilet Cleaning Brush",
        "brand": None,
        "price": 65,
        "mrp": 90,
        "desc": "Ergonomic toilet cleaning brush with strong nylon bristles and a sturdy stand. Essential for washroom sanitation.",
        "subcategory": "Cleaning Tools",
        "featured": False
    },
    "Yello Duster.jpg": {
        "name": "Yellow Duster Cloth",
        "brand": None,
        "price": 35,
        "mrp": 50,
        "desc": "Soft yellow cotton dusting cloth. Washable and reusable, perfect for dry dusting laptops, office desks, and glass screens.",
        "subcategory": "Dusters",
        "featured": False
    },
    "colin 500 ml.webp": {
        "name": "Colin Glass Cleaner 500ml",
        "brand": "Colin",
        "price": 95,
        "mrp": 125,
        "desc": "Colin streak-free glass and surface cleaner. 500ml spray bottle. Safe for mirrors, window panes, and office tables.",
        "subcategory": "Cleaning Chemicals",
        "featured": True
    },
    "dry mob frame.jpg": {
        "name": "Dry Mop Frame",
        "brand": None,
        "price": 220,
        "mrp": 280,
        "desc": "Heavy-duty metal/plastic dry mop frame with a 360-degree swivel joint. Fits standard dry mop refills.",
        "subcategory": "Mopping Equipment",
        "featured": False
    },
    "dry mob refill 24 inchs.jpeg": {
        "name": "Dry Mop Refill 24 Inches",
        "brand": None,
        "price": 140,
        "mrp": 180,
        "desc": "Acrylic dry mop refill sleeve, 24-inch size. Attracts dust statically and traps dirt efficiently. Washable.",
        "subcategory": "Mopping Equipment",
        "featured": False
    },
    "dry mob rfill cloth 18 inchs.webp": {
        "name": "Dry Mop Refill 18 Inches",
        "brand": None,
        "price": 110,
        "mrp": 145,
        "desc": "Cotton-acrylic blend dry mop refill cloth, 18-inch size. Highly effective for daily dust sweeping on smooth floors.",
        "subcategory": "Mopping Equipment",
        "featured": False
    },
    "floor-duster-small-500x500.webp": {
        "name": "Floor Duster Small",
        "brand": None,
        "price": 160,
        "mrp": 200,
        "desc": "Premium floor cleaning cloth (pocha). Thick, highly absorbent cotton fabric for wet mopping and floor cleaning.",
        "subcategory": "Dusters",
        "featured": False
    },
    "good-home-drainex-500x500.webp": {
        "name": "Good Home Drainex 50g",
        "brand": "Good Home",
        "price": 120,
        "mrp": 155,
        "desc": "Good Home Drainex drain cleaner powder. Fast-acting formula that dissolves grease, hair, and soap scum to clear blockages.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "green garbage bags.webp": {
        "name": "Green Garbage Bags Pack",
        "brand": None,
        "price": 180,
        "mrp": 230,
        "desc": "Green plastic garbage bags. Ideal for wet and dry waste segregation. Strong material, pack of 30.",
        "subcategory": "Garbage Bags",
        "featured": False
    },
    "harpic 500 ml.webp": {
        "name": "Harpic Toilet Cleaner 500ml",
        "brand": "Harpic",
        "price": 110,
        "mrp": 145,
        "desc": "Harpic Power Plus toilet cleaner. Disinfectant liquid that removes tough stains and kills 99.9% of germs.",
        "subcategory": "Cleaning Chemicals",
        "featured": True
    },
    "hit-black-red-500x500.webp": {
        "name": "Hit Black + Red Insect Killer",
        "brand": "Hit",
        "price": 175,
        "mrp": 225,
        "desc": "Dual action insecticide spray. Kills cockroaches, flies, and mosquitoes instantly. Safe for office pantries when used as directed.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "lizol 1 ltr.webp": {
        "name": "Lizol Floor Cleaner 1 Litre",
        "brand": "Lizol",
        "price": 215,
        "mrp": 275,
        "desc": "Lizol disinfectant floor cleaner, 1 Litre. Kills germs and cleans tough stains. Leaves a pleasant floral fragrance.",
        "subcategory": "Cleaning Chemicals",
        "featured": True
    },
    "lizol 500 ml.webp": {
        "name": "Lizol Floor Cleaner 500ml",
        "brand": "Lizol",
        "price": 125,
        "mrp": 160,
        "desc": "Lizol disinfectant floor cleaner, 500ml bottle. Ideal for daily floor disinfection and clean shine.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "m gild tissu paper.webp": {
        "name": "M Gild Tissue Paper Box",
        "brand": "M Gild",
        "price": 95,
        "mrp": 130,
        "desc": "Soft and absorbent facial tissues by M Gild. Premium quality sheets, ideal for corporate desks and reception counters.",
        "subcategory": "Tissues",
        "featured": False
    },
    "m-fold-tissue.webp": {
        "name": "M-Fold Paper Tissues",
        "brand": None,
        "price": 165,
        "mrp": 210,
        "desc": "M-fold paper towels for dispenser units. Multi-fold design ensures single sheet dispensing. Soft, strong, and absorbent.",
        "subcategory": "Tissues",
        "featured": False
    },
    "metal dustbin.jpg": {
        "name": "Metal Mesh Dustbin",
        "brand": None,
        "price": 450,
        "mrp": 580,
        "desc": "Sleek metal mesh wastepaper basket. Breathable mesh design, ideal for offices, workspaces, and study rooms.",
        "subcategory": "Bins",
        "featured": False
    },
    "odonil-room-freshener.webp": {
        "name": "Odonil Air Freshener Block",
        "brand": "Odonil",
        "price": 85,
        "mrp": 110,
        "desc": "Odonil hanger room freshener block. Long-lasting fragrance for wardrobes, bathrooms, and cabins.",
        "subcategory": "Air Fresheners",
        "featured": False
    },
    "ozone-floor-cleaner 1 ltr.jpg": {
        "name": "Ozone Floor Cleaner 1 Litre",
        "brand": "Ozone",
        "price": 180,
        "mrp": 230,
        "desc": "Ozone disinfectant floor cleaner liquid. Highly concentrated formula for streak-free cleaning and germ protection.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "soft-broom.jpg": {
        "name": "Soft Broom (Phool Jhadu)",
        "brand": None,
        "price": 85,
        "mrp": 115,
        "desc": "Traditional grass broom for indoor floor sweeping. Soft grass fibers trap fine dust without scratching surfaces.",
        "subcategory": "Brooms",
        "featured": False
    },
    "sunny phenyl 1ltr.webp": {
        "name": "Sunny Phenyl 1 Litre",
        "brand": "Sunny",
        "price": 110,
        "mrp": 145,
        "desc": "Sunny brand white disinfectant phenyl. Thick formulation with strong scent, ideal for washrooms and commercial corridors.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "toilet roll.jpg": {
        "name": "Jumbo Toilet Roll",
        "brand": None,
        "price": 140,
        "mrp": 180,
        "desc": "Jumbo toilet paper roll for commercial dispensers. 2-ply high absorbency paper. Cost-effective for office washrooms.",
        "subcategory": "Tissues",
        "featured": False
    },
    "ultra-soft-tissue-napkin-40x40.jpeg": {
        "name": "Ultra Soft Tissue Napkin 40x40cm",
        "brand": None,
        "price": 155,
        "mrp": 200,
        "desc": "Large 40x40 cm ultra-soft paper napkins. Highly absorbent, premium quality, suitable for corporate catering and canteen tables.",
        "subcategory": "Tissues",
        "featured": False
    },
    "vimbar big.jpg": {
        "name": "Vim Dishwash Bar Large",
        "brand": "Vim",
        "price": 45,
        "mrp": 65,
        "desc": "Vim dish cleaning bar, large size. Formulated with lemon power to remove tough oil and grease from pantry utensils.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "vimbar small.jpg": {
        "name": "Vim Dishwash Bar Small",
        "brand": "Vim",
        "price": 25,
        "mrp": 35,
        "desc": "Vim dish cleaning bar, small size. Compact and convenient for office tea cup washing and light cleaning.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    },
    "wet mob clip.png": {
        "name": "Wet Mop Clip and Holder",
        "brand": None,
        "price": 50,
        "mrp": 70,
        "desc": "Heavy-duty plastic mop clip for holding cotton floor cleaning refills securely. Compatible with standard thread handles.",
        "subcategory": "Mopping Equipment",
        "featured": False
    },
    "wet mob refill 250.jpg": {
        "name": "Wet Mop Refill 250g",
        "brand": None,
        "price": 90,
        "mrp": 120,
        "desc": "Premium cotton yarn wet mop refill, 250g weight. High water absorption capacity for efficient wet floor cleaning.",
        "subcategory": "Mopping Equipment",
        "featured": False
    },
    "wheel powdar.jpg": {
        "name": "Wheel Active Detergent Powder",
        "brand": "Wheel",
        "price": 75,
        "mrp": 100,
        "desc": "Active detergent powder by Wheel. Clean wash with lemon freshness. Ideal for office uniforms, table cloths, and cleaning cloths.",
        "subcategory": "Cleaning Chemicals",
        "featured": False
    }
}

ST_MAPPING = {
    "Apsara HB Pencil - Copy (2).jpg": {
        "name": "Apsara HB Pencil Pack",
        "brand": "Apsara",
        "price": 60,
        "mrp": 80,
        "desc": "Apsara HB pencils, pack of 10. High-quality graphite lead for smooth, dark writing. Includes sharpener and eraser in pack.",
        "subcategory": "Pencils & Erasers",
        "featured": True
    },
    "Camlin Permanent Maker - Copy (2).jpeg": {
        "name": "Camlin Permanent Marker",
        "brand": "Camlin",
        "price": 35,
        "mrp": 50,
        "desc": "Camlin permanent marker. Quick-drying, waterproof, and fade-resistant ink. Writes on most surfaces. Perfect for carton labeling.",
        "subcategory": "Pens & Markers",
        "featured": False
    },
    "Drawing Pins (Bord) - Copy - Copy.webp": {
        "name": "Drawing Pins Board Pins",
        "brand": None,
        "price": 25,
        "mrp": 35,
        "desc": "Steel drawing pins / board pins for notice boards and cork boards. Rust-resistant sharp pins. Pack of 50.",
        "subcategory": "Office Supplies",
        "featured": False
    },
    "Laxi Ball Pen - Copy - Copy.jpg": {
        "name": "Laxi Ball Pen Blue",
        "brand": "Laxi",
        "price": 15,
        "mrp": 25,
        "desc": "Laxi ballpoint pen with smooth-flowing blue ink. Comfortable grip for fatigue-free office writing. Pack of 5.",
        "subcategory": "Pens & Markers",
        "featured": False
    },
    "Natraj eraser - Copy (2).webp": {
        "name": "Natraj Premium Eraser",
        "brand": "Natraj",
        "price": 10,
        "mrp": 15,
        "desc": "Natraj non-dust premium eraser. Soft PVC formulation that erases cleanly without leaving dust or tearing the paper. Pack of 10.",
        "subcategory": "Pencils & Erasers",
        "featured": False
    },
    "Natraj sharpner - Copy.webp": {
        "name": "Natraj Pencil Sharpener",
        "brand": "Natraj",
        "price": 12,
        "mrp": 20,
        "desc": "Natraj pencil sharpener with rust-resistant steel blade. Compact ergonomic design for smooth sharpening.",
        "subcategory": "Pencils & Erasers",
        "featured": False
    },
    "Paper Clip -35 mm Rolex 1x10 - Copy.jpg": {
        "name": "Rolex Paper Clips 35mm",
        "brand": "Rolex",
        "price": 45,
        "mrp": 60,
        "desc": "Rolex zinc-plated paper clips, 35mm size. Strong clamping force, rust-proof. Pack of 100 clips.",
        "subcategory": "Office Supplies",
        "featured": False
    },
    "Pik Sketch Pen Set - Copy.jpeg": {
        "name": "Pik Sketch Pen Set 12 Colors",
        "brand": "Pik",
        "price": 95,
        "mrp": 120,
        "desc": "Pik sketch pens in 12 vibrant colors. Assorted sketch pen set with durable fiber tips. Great for chart work and highlighting.",
        "subcategory": "Pens & Markers",
        "featured": False
    },
    "Pink Highlighter - Copy.jpg": {
        "name": "Fluorescent Pink Highlighter",
        "brand": None,
        "price": 20,
        "mrp": 30,
        "desc": "Bright fluorescent pink highlighter. Chisel tip for fine and broad marking. Water-based ink, smudge-free.",
        "subcategory": "Pens & Markers",
        "featured": False
    },
    "Stapler Machine - HD 45 Kangaroo - Copy.jpg": {
        "name": "Kangaroo HD-45 Stapler",
        "brand": "Kangaroo",
        "price": 290,
        "mrp": 360,
        "desc": "Kangaroo HD-45 heavy-duty metal stapler. Staples up to 45 sheets. Ergonomic handle and built-in staple remover.",
        "subcategory": "Stapling & Punching",
        "featured": True
    },
    "Stapler Machine - HP 45 kangaroo - Copy.webp": {
        "name": "Kangaroo HP-45 Plier Stapler",
        "brand": "Kangaroo",
        "price": 265,
        "mrp": 330,
        "desc": "Kangaroo HP-45 plier-type stapler. All-metal construction with comfortable grip. Staples up to 30 sheets easily.",
        "subcategory": "Stapling & Punching",
        "featured": False
    },
    "Stapler Machine - No .10 Kangaroo - Copy.jpeg": {
        "name": "Kangaroo No. 10 Stapler",
        "brand": "Kangaroo",
        "price": 175,
        "mrp": 220,
        "desc": "Kangaroo No. 10 compact desk stapler. Reliable stapling up to 15 sheets. Portable and durable.",
        "subcategory": "Stapling & Punching",
        "featured": False
    },
    "Stapler Pin - 23 X17 Kangaroo - Copy.jpg": {
        "name": "Kangaroo 23x17 Stapler Pins",
        "brand": "Kangaroo",
        "price": 55,
        "mrp": 75,
        "desc": "Kangaroo 23x17 mm steel stapler pins. Heavy-duty staples for thick papers. Box of 1000 pins.",
        "subcategory": "Stapling & Punching",
        "featured": False
    },
    "Stapler Pin - 24 X6 Kangaroo - Copy.webp": {
        "name": "Kangaroo 24x6 Stapler Pins",
        "brand": "Kangaroo",
        "price": 65,
        "mrp": 85,
        "desc": "Kangaroo 24x6 mm standard stapler pins. Box of 1000 pins. Compatible with standard office staplers.",
        "subcategory": "Stapling & Punching",
        "featured": False
    },
    "Stapler Pin - No 10. Kangroo - Copy.webp": {
        "name": "Kangaroo No. 10 Stapler Pins",
        "brand": "Kangaroo",
        "price": 40,
        "mrp": 55,
        "desc": "Kangaroo No. 10 mini stapler pins. Zinc coated to prevent rust. Box of 1000 pins.",
        "subcategory": "Stapling & Punching",
        "featured": False
    },
    "Writing pad Ruled - Copy.jpg": {
        "name": "A4 Ruled Writing Pad",
        "brand": None,
        "price": 70,
        "mrp": 90,
        "desc": "A4 size ruled writing pad. Features 60 sheets of white paper with margin lines. Sturdy cardboard backing.",
        "subcategory": "Paper Products",
        "featured": True
    },
    "u-shaped-paper-clip - Copy.jpg": {
        "name": "U-Shaped Metal Paper Clips",
        "brand": None,
        "price": 25,
        "mrp": 35,
        "desc": "Premium quality U-shaped metal paper clips. Non-skid design, holds documents firmly without tearing. Pack of 100.",
        "subcategory": "Office Supplies",
        "featured": False
    },
    "writing-pad-1-150x150 - Copy.webp": {
        "name": "Small Ruled Notepad",
        "brand": None,
        "price": 40,
        "mrp": 55,
        "desc": "Compact pocket-sized notebook / writing pad. 40 sheets, ruled pages. Perfect for quick notes and reminders.",
        "subcategory": "Paper Products",
        "featured": False
    }
}

# Mapping files to process
# Housekeeping has duplicates for Scotchbrite and Checks Duster. We filter them here.
HK_DUPLICATES = {
    "Checks Duster.jpg": "Checks Duster.webp",
    "Scothbrite Big.avif": "Scothbrite Big.jpg"
}

# Stationery has duplicates for Natraj Eraser and Natraj Sharpener
ST_DUPLICATES = {
    "Natraj eraser - Copy - Copy.webp": "Natraj eraser - Copy (2).webp",
    "nataraj-eraser - Copy (2).jpg": "Natraj eraser - Copy (2).webp",
    "nataraj-eraser - Copy - Copy.jpg": "Natraj eraser - Copy (2).webp",
    "Natraj sharpne - Copy.webp": "Natraj sharpner - Copy.webp"
}

products_out = []

def clean_slug(name):
    # Convert name to a clean URL slug
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug

def process_images(src_dir, mapping, category_slug, duplicates):
    for filename in os.listdir(src_dir):
        # Skip directories
        if os.path.isdir(os.path.join(src_dir, filename)):
            continue
            
        # Check if it is a duplicate that we map to another file
        if filename in duplicates:
            print(f"Skipping duplicate file: {filename} (handled by {duplicates[filename]})")
            continue
            
        # Find product config in mapping
        p_cfg = mapping.get(filename)
        if not p_cfg:
            # Check if this filename is mapped by another key (could be key typo or lowercase variance)
            # Let's do a case-insensitive check
            found = False
            for k, val in mapping.items():
                if k.lower() == filename.lower():
                    p_cfg = val
                    found = True
                    break
            if not found:
                print(f"Warning: file {filename} not found in metadata mapping!")
                continue

        src_path = os.path.join(src_dir, filename)
        
        # Determine output filename
        clean_name = clean_slug(p_cfg["name"])
        out_filename = f"{clean_name}.webp"
        dest_path = os.path.join(DEST_DIR, out_filename)
        
        try:
            # Open and convert
            with Image.open(src_path) as img:
                # Convert RGBA/P to RGB if converting to WebP
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    img = img.convert('RGBA')
                    # Save with transparency if webp
                else:
                    img = img.convert('RGB')
                
                # Resize if larger than 800x800
                img.thumbnail((800, 800), Image.Resampling.LANCZOS)
                
                # Save as optimized WebP
                img.save(dest_path, "WEBP", quality=85, optimize=True)
                print(f"Success: {filename} -> {out_filename}")
                
                # Add to json output
                products_out.append({
                    "name": p_cfg["name"],
                    "brand": p_cfg["brand"],
                    "price": p_cfg["price"],
                    "mrp": p_cfg["mrp"],
                    "description": p_cfg["desc"],
                    "category_slug": category_slug,
                    "subcategory": p_cfg["subcategory"],
                    "featured": p_cfg["featured"],
                    "image_url": f"/uploads/{out_filename}"
                })
        except Exception as e:
            print(f"Error processing {filename}: {e}")

print("Processing Housekeeping Images...")
process_images(HK_SRC, HK_MAPPING, "housekeeping", HK_DUPLICATES)

print("\nProcessing Stationery Images...")
process_images(ST_SRC, ST_MAPPING, "office-stationery", ST_DUPLICATES)

# Write json output
out_json_path = os.path.join(WORKSPACE, "scripts/seeded-data.json")
with open(out_json_path, "w", encoding="utf-8") as f:
    json.dump(products_out, f, indent=2, ensure_ascii=False)

print(f"\nCompleted! Saved metadata for {len(products_out)} products to {out_json_path}")
