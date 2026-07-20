const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE5B4" />
      <stop offset="50%" stop-color="#D4AF37" />
      <stop offset="100%" stop-color="#996515" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#gold)" />
  <text x="50%" y="54%" font-size="220" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">AK</text>
</svg>
`;

async function run() {
  const publicDir = path.resolve('public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Write SVG
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svg);
  console.log('Wrote favicon.svg');
  
  // Generate PNGs
  const buffer = Buffer.from(svg);
  
  await sharp(buffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico')); // save 32x32 png as favicon.ico
  await sharp(buffer).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16x16.png'));
  await sharp(buffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(buffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(buffer).resize(192, 192).png().toFile(path.join(publicDir, 'android-chrome-192x192.png'));
  await sharp(buffer).resize(512, 512).png().toFile(path.join(publicDir, 'android-chrome-512x512.png'));
  
  // Write manifest
  const manifest = {
    name: 'AK Enterprises',
    short_name: 'AK Ent',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    theme_color: '#D4AF37',
    background_color: '#ffffff',
    display: 'standalone'
  };
  fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
  console.log('Generated all favicon assets successfully!');
}

run().catch(console.error);
