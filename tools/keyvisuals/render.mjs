// Renders the key-visual posters (HTML compositions) to WebP.
// Usage: node tools/keyvisuals/render.mjs [id ...]
// Requires Playwright (globally available in the dev container) and Python Pillow for WebP encoding.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../public/images/keyvisuals');
const pwPath = process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(pwPath);

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(here).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
for (const id of ids) {
  await page.goto(pathToFileURL(join(here, `${id}.html`)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const png = join(out, `${id}.png`);
  await page.screenshot({ path: png });
  execFileSync('python3', ['-I', '-c', `
from PIL import Image
import os
src = ${JSON.stringify(png)}
im = Image.open(src).convert('RGB')
im.resize((1920, 1200), Image.LANCZOS).save(src[:-4] + '.webp', 'WEBP', quality=86, method=6)
im.resize((960, 600), Image.LANCZOS).save(src[:-4] + '-sm.webp', 'WEBP', quality=82, method=6)
os.remove(src)
`]);
  console.log('rendered', id);
}
await browser.close();
