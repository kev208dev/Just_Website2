// Captures the hero sculpture (live Three.js render) as transparent stills used
// for first paint and as the no-WebGL fallback. Run against `npm run preview`.
// Usage: node tools/render-hero-poster.mjs [baseUrl]
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://127.0.0.1:4321/Just_Website2/';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/images/brand');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const [name, w, h] of [['hero-logo', 1920, 1200], ['hero-logo-portrait', 900, 1800]]) {
  const page = await browser.newPage({ viewport: { width: w / 1.5, height: h / 1.5 }, deviceScaleFactor: 1.5, reducedMotion: 'reduce' });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('[data-hero]')?.classList.contains('is-live'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: `html,body,.hero{background:transparent!important} .hero > :not([data-hero-stage]), .site-header, .cursor, .hero__poster {visibility:hidden!important}` });
  const png = `${out}/${name}.png`;
  await page.locator('[data-hero]').screenshot({ path: png, omitBackground: true });
  execFileSync('python3', ['-I', '-c', `from PIL import Image\nimport os\nim=Image.open(${JSON.stringify(png)}).convert('RGBA')\nim.save(${JSON.stringify(png.replace('.png', '.webp'))}, 'WEBP', quality=88, method=6)\nos.remove(${JSON.stringify(png)})`]);
  console.log('rendered', name);
  await page.close();
}
await browser.close();
