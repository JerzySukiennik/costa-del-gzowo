// Costa del Gzowo: two real clients in separate browser profiles meet through the live database and WebRTC; prints what each one sees of the other.
// node mp-test.mjs <baseUrl> <outPrefix>
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const [base = 'http://localhost:8907/', out = 'mp'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--force_high_performance_gpu'],
});
const logs = [];
async function client(tag, query) {
  const context = await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${tag} ${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => logs.push(`[${tag} pageerror] ${e.message}`));
  await page.goto(`${base}?auto=1&quality=medium&${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 200000 });
  return page;
}
const key = (page, code, on) => page.evaluate(([c, o]) => window.dispatchEvent(new KeyboardEvent(o ? 'keydown' : 'keyup', { code: c, key: c, bubbles: true })), [code, on]);
const stats = (page) => page.evaluate(() => (window.__dbg.net ? window.__dbg.net.stats() : null));
const say = (label, value) => console.log(label, JSON.stringify(value));

const a = await client('A', 'name=Ala');
const b = await client('B', 'name=Bob&car=roadster&avatar=jurek');
await a.waitForTimeout(4000);
let linked = false;
for (let i = 0; i < 40 && !linked; i++) {
  const [sa, sb] = [await stats(a), await stats(b)];
  linked = !!sa && !!sb && sa.links.some((l) => l.open || l.relay) && sb.links.some((l) => l.open || l.relay);
  if (!linked) await a.waitForTimeout(1000);
}
say('A stats', await stats(a));
say('B stats', await stats(b));
await b.evaluate(() => window.__dbg.play.seat());
await key(b, 'KeyW', true);
await a.waitForTimeout(3500);
await key(b, 'KeyW', false);
await a.waitForTimeout(1500);
const bCar = await b.evaluate(() => window.__dbg.play.car.position.toArray().map((n) => +n.toFixed(1)));
const seen = await stats(a);
say('B car at', bCar);
say('A sees', seen && seen.remotes);
await a.evaluate(() => {
  const d = window.__dbg;
  const r = [...d.net.remotes.values()][0];
  const p = r.vehicle ? r.vehicle.model.group.position : r.tag;
  d.look(p.x + 6, p.y + 2.2, p.z - 6, p.x, p.y + 0.8, p.z);
});
await a.waitForTimeout(2500);
await a.screenshot({ path: `${out}-a-sees-b.png` });
await a.evaluate(() => {
  const d = window.__dbg;
  const r = [...d.net.remotes.values()][0];
  d.play.game.cinematic = false;
  const m = r.vehicle.model;
  const spot = m.group.localToWorld(new (m.group.position.constructor)(m.seat.x, 0, -m.seat.z + 1.6));
  d.play.player.teleport(spot.x, spot.y + 0.3, spot.z, 0);
});
await a.waitForTimeout(1200);
say('A ride prompt', await a.evaluate(() => document.getElementById('prompt').textContent));
await key(a, 'KeyF', true);
await a.waitForTimeout(150);
await key(a, 'KeyF', false);
await a.waitForTimeout(1500);
say('A mode', await a.evaluate(() => ({ mode: window.__dbg.play.game.mode, riding: !!window.__dbg.net.riding })));
await key(b, 'Space', true);
await a.waitForTimeout(1200);
await key(b, 'Space', false);
await a.waitForTimeout(2500);
say('B sees', (await stats(b)).remotes);
say('A height while riding', await a.evaluate(() => +window.__dbg.play.player.state.position.y.toFixed(1)));
await a.screenshot({ path: `${out}-a-riding.png` });
await b.evaluate(() => {
  const d = window.__dbg;
  const p = d.play.car.position;
  d.look(p.x + 5, p.y + 1.6, p.z + 4.5, p.x, p.y + 0.7, p.z);
});
await b.waitForTimeout(2200);
await b.screenshot({ path: `${out}-b-sees-passenger.png` });
console.log(logs.slice(-30).join('\n'));
await browser.close();
