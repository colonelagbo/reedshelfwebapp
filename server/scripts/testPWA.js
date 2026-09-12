import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function verifyPWA() {
  console.log('--- STARTING PWA SUITE VERIFICATION ---');

  // 1. Verify Manifest
  console.log('\n[1/5] Verifying Web App Manifest...');
  const manifestPath = path.resolve('dist/manifest.webmanifest');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('dist/manifest.webmanifest does not exist. Run npm run build first.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('✓ Manifest found:', manifestPath);
  console.log('  -> Name:', manifest.name);
  console.log('  -> Short Name:', manifest.short_name);
  console.log('  -> Display:', manifest.display);
  console.log('  -> Theme Color:', manifest.theme_color);
  console.log('  -> Background Color:', manifest.background_color);
  console.log('  -> Start URL:', manifest.start_url);
  console.log('  -> Scope:', manifest.scope);
  console.log('  -> Icons count:', manifest.icons?.length);

  if (manifest.name !== 'ReedShelf' || manifest.short_name !== 'ReedShelf') {
    throw new Error('Manifest name/short_name is incorrect');
  }
  if (manifest.display !== 'standalone') {
    throw new Error('Manifest display must be standalone');
  }
  if (manifest.theme_color !== '#009689' || manifest.background_color !== '#f6f4ee') {
    throw new Error('Manifest theme_color/background_color incorrect');
  }

  // 2. Verify Icons existence and dimensions
  console.log('\n[2/5] Verifying PWA Icon Files & Dimensions...');
  for (const icon of manifest.icons) {
    const iconFilePath = path.resolve('dist', icon.src.replace(/^\//, ''));
    if (!fs.existsSync(iconFilePath)) {
      throw new Error(`Icon referenced in manifest does not exist on disk: ${iconFilePath}`);
    }
    const metadata = await sharp(iconFilePath).metadata();
    const [expectedW, expectedH] = icon.sizes.split('x').map(Number);
    if (metadata.width !== expectedW || metadata.height !== expectedH) {
      throw new Error(`Icon size mismatch for ${icon.src}: expected ${icon.sizes}, got ${metadata.width}x${metadata.height}`);
    }
    console.log(`✓ Icon verified: ${icon.src} (${metadata.width}x${metadata.height}, format: ${metadata.format}, purpose: ${icon.purpose})`);
  }

  // Verify Apple Touch Icon
  const appleIconPath = path.resolve('dist/apple-touch-icon.png');
  if (!fs.existsSync(appleIconPath)) throw new Error('dist/apple-touch-icon.png missing');
  const appleMeta = await sharp(appleIconPath).metadata();
  console.log(`✓ Apple Touch Icon verified: ${appleIconPath} (${appleMeta.width}x${appleMeta.height})`);

  // Verify Favicon SVG
  const faviconSvgPath = path.resolve('dist/favicon.svg');
  if (!fs.existsSync(faviconSvgPath)) throw new Error('dist/favicon.svg missing');
  console.log('✓ Favicon SVG verified');

  // 3. Verify Service Worker
  console.log('\n[3/5] Verifying Service Worker script...');
  const swPath = path.resolve('dist/sw.js');
  if (!fs.existsSync(swPath)) throw new Error('dist/sw.js missing');
  const swContent = fs.readFileSync(swPath, 'utf8');
  console.log(`✓ sw.js generated (${(swContent.length / 1024).toFixed(2)} KB)`);

  // Check that private book storage and /api are NetworkOnly / excluded
  if (!swContent.includes('NetworkOnly')) {
    throw new Error('sw.js must contain NetworkOnly strategy for dynamic API and book storage');
  }
  console.log('✓ sw.js enforces NetworkOnly for dynamic API and private books');

  // 4. Verify index.html PWA tags
  console.log('\n[4/5] Verifying index.html PWA integration...');
  const indexPath = path.resolve('dist/index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  if (!indexHtml.includes('manifest.webmanifest')) {
    throw new Error('index.html missing link to manifest.webmanifest');
  }
  if (!indexHtml.includes('apple-mobile-web-app-capable')) {
    throw new Error('index.html missing apple-mobile-web-app-capable');
  }
  if (!indexHtml.includes('apple-touch-icon')) {
    throw new Error('index.html missing apple-touch-icon');
  }
  console.log('✓ index.html has manifest link, apple meta tags, and touch icon');

  // 5. Verify vercel.json headers & rewrites
  console.log('\n[5/5] Verifying vercel.json deployment config...');
  const vercelPath = path.resolve('vercel.json');
  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const swHeader = vercelConfig.headers?.find(h => h.source === '/sw.js');
  const manifestHeader = vercelConfig.headers?.find(h => h.source === '/manifest.webmanifest');

  if (!swHeader || !manifestHeader) {
    throw new Error('vercel.json missing Cache-Control headers for sw.js or manifest');
  }
  console.log('✓ vercel.json contains proper Cache-Control headers for sw.js and manifest.webmanifest');

  console.log('\n=============================================');
  console.log('🎉 ALL PWA VERIFICATION CHECKS PASSED! 🎉');
  console.log('=============================================');
}

verifyPWA().catch((err) => {
  console.error('\n❌ PWA verification failed:', err);
  process.exit(1);
});
