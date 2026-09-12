import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const iconsDir = path.resolve('public/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Logo mark path definitions
const logoPaths = `
  <g>
    <path d="M247.48,586.87c-6.65,6.65-10.74,15.9-10.61,26.07.24,20,17.17,35.81,37.17,35.81h96.24l205.37-.18.11.18h7.78c10.01,0,19.07-4.07,25.63-10.61,6.54-6.56,10.61-15.62,10.61-25.63,0-20.02-16.23-36.24-36.24-36.24h-310.44c-10.01,0-19.07,4.05-25.63,10.61Z"/>
    <path d="M273.09,358.78h534.51c-34.51-45.89-92.07-72.49-163.09-72.49h-371.42c-10.01,0-19.07,4.05-25.63,10.61-6.56,6.56-10.61,15.62-10.61,25.63,0,20.02,16.23,36.24,36.24,36.24Z"/>
    <path d="M730.5,648.75c36.84-14.18,66.23-39.52,85.74-72.49h-87.73c-10.01,0-19.07,4.07-25.63,10.61-6.55,6.56-10.61,15.62-10.61,25.63,0,20.02,16.23,36.24,36.24,36.24h1.99Z"/>
    <path d="M496.47,431.29c-10.01,0-19.07,4.07-25.63,10.61-6.55,6.56-10.61,15.62-10.61,25.63,0,20.02,16.23,36.24,36.24,36.24h344.55c1.42-10.1,2.13-20.49,2.13-31.18,0-14.46-1.31-28.24-3.86-41.31h-342.81Z"/>
    <path d="M691.47,721.22h-418.38c-10.01,0-19.07,4.05-25.63,10.61-6.56,6.56-10.61,15.62-10.61,25.63,0,20.02,16.23,36.24,36.24,36.24h553c-29.83-45.27-80.42-72.49-134.62-72.49Z"/>
    <path d="M351.5,431.29h-78.39c-10.01,0-19.07,4.05-25.63,10.61-6.65,6.65-10.74,15.9-10.61,26.07.24,20,17.17,35.81,37.17,35.81h77.46c10.01,0,19.07-4.07,25.63-10.61,6.54-6.56,10.61-15.62,10.61-25.63,0-20.02-16.23-36.24-36.24-36.24Z"/>
  </g>
`;

// 1. Transparent icon with brand emerald color (#009689)
function makeTransparentSvg(viewBoxSize = 750) {
  const cx = 540;
  const cy = 522;
  const half = viewBoxSize / 2;
  const vx = cx - half;
  const vy = cy - half;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${viewBoxSize} ${viewBoxSize}">
    <g fill="#009689">
      ${logoPaths}
    </g>
  </svg>`;
}

// 2. Solid branded background icon (Emerald #009689 with crisp white logo)
// Perfect for maskable icons (Android adaptive icons) and Apple touch icons (no black background)
function makeSolidSvg(viewBoxSize = 900, bgColor = '#009689', fgColor = '#ffffff') {
  const cx = 540;
  const cy = 522;
  const half = viewBoxSize / 2;
  const vx = cx - half;
  const vy = cy - half;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${viewBoxSize} ${viewBoxSize}">
    <rect x="${vx}" y="${vy}" width="${viewBoxSize}" height="${viewBoxSize}" fill="${bgColor}" />
    <g fill="${fgColor}">
      ${logoPaths}
    </g>
  </svg>`;
}

async function run() {
  console.log('Generating PWA icons...');

  // 1. Favicon SVG
  const faviconSvg = makeTransparentSvg(680);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);

  // 2. Any icons (transparent emerald logo mark)
  const transparentSvg = Buffer.from(makeTransparentSvg(750));
  await sharp(transparentSvg).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png'));
  await sharp(transparentSvg).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png'));

  // 3. Maskable icons (solid #009689 emerald with safe-area white logo mark)
  const maskableSvg = Buffer.from(makeSolidSvg(960, '#009689', '#ffffff'));
  await sharp(maskableSvg).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));
  await sharp(maskableSvg).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));

  // 4. Apple Touch Icon (180x180 solid background to prevent iOS black background bug)
  const appleTouchSvg = Buffer.from(makeSolidSvg(880, '#009689', '#ffffff'));
  await sharp(appleTouchSvg).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(appleTouchSvg).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));

  // 5. Favicon PNG (32x32 and 48x48)
  await sharp(transparentSvg).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(transparentSvg).resize(48, 48).png().toFile(path.join(publicDir, 'favicon.ico'));

  console.log('✓ All PWA icons generated successfully!');
}

run().catch(console.error);
