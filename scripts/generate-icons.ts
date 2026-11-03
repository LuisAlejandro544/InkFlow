import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

async function generate() {
  const publicDir = path.resolve('public');
  const svgPath = path.join(publicDir, 'icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Rendering 512x512 PNG...');
  const png512Buffer = await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512Buffer);

  console.log('Rendering 192x192 PNG...');
  const png192Buffer = await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192Buffer);

  console.log('Rendering 180x180 Apple Touch Icon...');
  const appleTouchBuffer = await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouchBuffer);

  console.log('Rendering Maskable Icon (safe zone padded for Android circular/squircle launchers)...');
  // For maskable icon: background dark fill 512x512, with the icon scaled to ~80% (410px) centered
  const innerIcon = await sharp(svgBuffer)
    .resize(410, 410)
    .png()
    .toBuffer();

  const maskableBuffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 16, g: 17, b: 24, alpha: 1 }, // Matches #101118 dark obsidian
    },
  })
    .composite([
      {
        input: innerIcon,
        gravity: 'center',
      },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskableBuffer);

  console.log('Generating favicon.ico (16, 32, 48)...');
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();

  const icoBuffer = await pngToIco([png16, png32, png48]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  console.log('All icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
