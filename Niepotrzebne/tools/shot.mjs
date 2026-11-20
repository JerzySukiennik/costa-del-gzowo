// Costa del Gzowo: headless Chrome (real GPU via ANGLE/Metal) screenshots with console capture.
// node shot.mjs <url> <outPrefix> [steps.json | inline setup JS] [waitMs] [width] [height]
// steps.json: [{ "js": "...", "wait": 1500, "shot": "name" }, ...]; each step evaluates js, waits, then saves <outPrefix>-<name>.png.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const [url, out = 'shot', setup = '', wait = '3000', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--force_high_performance_gpu'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));
await page.goto(url, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: +(process.env.BOOT || 90000) });
} catch (e) {
  logs.push('[harness] boot timeout');
}
const steps = setup && existsSync(setup) ? JSON.parse(readFileSync(setup, 'utf8')) : [{ js: setup, wait: +wait, shot: '' }];
for (const step of steps) {
  if (step.js) {
    try {
      const r = await page.evaluate(step.js);
      if (r !== undefined) logs.push('[step] ' + JSON.stringify(r));
    } catch (e) {
      logs.push('[step error] ' + e.message);
    }
  }
  await page.waitForTimeout(step.wait ?? +wait);
  if (step.shot !== undefined) await page.screenshot({ path: step.shot ? `${out}-${step.shot}.png` : `${out}.png` });
}
console.log(logs.slice(-80).join('\n'));
await browser.close();
