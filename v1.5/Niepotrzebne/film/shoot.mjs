// Costa del Gzowo film: local stepped capture of chosen frames (design stills only; full renders run on Kaggle).
// node shoot.mjs <video> <out dir> <shots: "all" | "2,5"> [every N frames=15] [dpr=0.5] [base url]
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const HERE = dirname(fileURLToPath(import.meta.url));
const [video, out, which = 'all', every = '15', dpr = '0.5', base = 'http://127.0.0.1:8911/'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const scripts = [join(HERE, 'runtime/vt.js'), join(HERE, 'runtime/poses.js'), join(HERE, 'runtime/film.js'), ...readdirSync(join(HERE, 'videos')).filter((f) => f.endsWith('.js')).map((f) => join(HERE, 'videos', f))];
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--force_high_performance_gpu', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: +dpr });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
for (const s of scripts) await page.addInitScript({ content: readFileSync(s, 'utf8') });
await page.goto(base + '?auto=1&avatar=jurek&car=roadster&quality=ultra', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true && window.__dbg && window.__dbg.mode === 'playing', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const plan = (await page.evaluate((v) => window.__film.start(v), video)).shots;
if (process.env.PROBE) console.log('[probe]', JSON.stringify(await page.evaluate(readFileSync(process.env.PROBE, 'utf8'))));
const pick = which === 'all' ? plan.map((_, i) => i) : which.split(',').map(Number);
const t0 = Date.now();
for (const i of pick) {
  const s = plan[i];
  await page.evaluate((k) => window.__film.enter(k), i);
  for (let k = 0; k < s.pre + s.frames; k++) {
    const cap = k - s.pre;
    const near = cap >= 0 && (((+every - (cap % +every)) % +every) < 4 || cap >= s.frames - 4);
    await page.evaluate((r) => window.__film.advance(r), near || cap < 0 && k >= s.pre - 4);
    if (cap >= 0 && (cap % +every === 0 || cap === s.frames - 1)) {
      await page.waitForFunction(() => window.__vt.pending === 0, null, { timeout: 2000 }).catch(() => {});
      await page.screenshot({ path: join(out, `${String(i).padStart(2, '0')}-${s.name}-${String(cap).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 85 });
    } else if (near) {
      await page.waitForFunction(() => window.__vt.pending === 0, null, { timeout: 2000 }).catch(() => {});
    }
  }
}
console.log(JSON.stringify(plan), ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(logs.slice(-30).join('\n'));
await browser.close();
