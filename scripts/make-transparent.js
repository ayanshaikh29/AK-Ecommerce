const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function run() {
  const inputPath = path.join(process.cwd(), 'public', 'stamp-signature.png');
  const outputPath = path.join(process.cwd(), 'public', 'stamp-signature-transparent.png');

  if (!fs.existsSync(inputPath)) {
    console.error('Input file does not exist:', inputPath);
    return;
  }

  console.log('Loading image...');
  const image = sharp(inputPath);
  const { width, height, channels } = await image.metadata();
  console.log(`Dimensions: ${width}x${height}, channels: ${channels}`);

  // Get raw pixel buffer
  const { data, info } = await image
    .ensureAlpha() // Ensure we have 4 channels (RGBA)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rawBuffer = data;
  const length = rawBuffer.length;

  console.log('Processing pixels to remove black background...');
  // Loop through RGBA pixels
  for (let i = 0; i < length; i += 4) {
    const r = rawBuffer[i];
    const g = rawBuffer[i + 1];
    const b = rawBuffer[i + 2];

    // If pixel is black or very dark, make it fully transparent.
    // Since the ink is dark blue/purple, we check if R, G, B are all low.
    // Let's use a threshold of 45.
    const maxVal = Math.max(r, g, b);
    
    // We can also compute the brightness. If it is low, make it transparent.
    if (maxVal < 60) {
      rawBuffer[i + 3] = 0; // Set alpha to 0 (fully transparent)
    } else {
      // It is part of the ink. Since it's a bit dark, let's boost the blue/purple color
      // to make it look like a clean stamp on the white page.
      // E.g., make it slightly more vibrant or keep it as is.
      // Let's keep it as is, but we can make sure the alpha is fully opaque (255).
      rawBuffer[i + 3] = 255;
    }
  }

  console.log('Saving processed image...');
  await sharp(rawBuffer, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
  .png()
  .toFile(outputPath);

  console.log('Saved transparent version to:', outputPath);
}

run().catch(console.error);
