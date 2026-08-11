const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function run() {
  const inputPath = path.join(process.cwd(), 'public', 'stamp-signature-transparent.png');
  const outputPath = path.join(process.cwd(), 'public', 'stamp-signature-optimized.png');

  if (!fs.existsSync(inputPath)) {
    console.error('Input file does not exist:', inputPath);
    return;
  }

  console.log('Optimizing stamp image...');
  // Resize to a reasonable dimension that looks good on A4 PDF at ~150dpi
  // 55mm @ 150dpi = ~325px wide.  Keep aspect ratio.
  await sharp(inputPath)
    .resize({ width: 650, withoutEnlargement: true }) // 2x for quality
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);

  const inSize = fs.statSync(inputPath).size;
  const outSize = fs.statSync(outputPath).size;
  console.log(`Input:  ${(inSize/1024).toFixed(1)} KB`);
  console.log(`Output: ${(outSize/1024).toFixed(1)} KB`);
  console.log('Done:', outputPath);
}

run().catch(console.error);
