// Costa del Gzowo: two real clients in separate browser profiles meet through the live database and WebRTC; prints what each one sees of the other.
// node mp-test.mjs <baseUrl> <outPrefix>
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const [base = 'http://localhost:8907/', out = 'mp'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--force_high_performance_gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
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
const b = await client('B', 'name=Bob&avatar=jurek');
await a.waitForTimeout(4000);
let linked = false;
for (let i = 0; i < 40 && !linked; i++) {
  const [sa, sb] = [await stats(a), await stats(b)];
  linked = !!sa && !!sb && sa.links.some((l) => l.open || l.relay) && sb.links.some((l) => l.open || l.relay) && sb.owners.every((o) => o >= 0);
  if (!linked) await a.waitForTimeout(1000);
}
say('A stats', await stats(a));
say('B stats', await stats(b));
const toDoor = (page, k) => page.evaluate(async (index) => {
  const d = window.__dbg;
  const hf = await import('/src/world/heightfield.js');
  const f = d.play.fleet[index];
  const spot = f.model.group.localToWorld(f.entry.doorLocal.clone());
  d.play.player.teleport(spot.x, hf.heightAt(spot.x, spot.z), spot.z, 0);
}, k);
const tap = async (page, code, ms = 150) => {
  await key(page, code, true);
  await page.waitForTimeout(ms);
  await key(page, code, false);
};
await toDoor(b, 2);
await b.waitForTimeout(800);
say('B prompt', await b.evaluate(() => document.getElementById('prompt').textContent));
await tap(b, 'KeyF');
await b.waitForFunction(() => window.__dbg.play.game.mode === 'car', null, { timeout: 90000, polling: 500 }).catch(() => logs.push('[B] never got seated'));
await b.waitForTimeout(1000);
say('B mode', await b.evaluate(() => ({ mode: window.__dbg.play.game.mode, vehicle: window.__dbg.play.vehicle.index, owners: window.__dbg.net.owners })));
await key(b, 'KeyW', true);
await a.waitForTimeout(6000);
await key(b, 'KeyW', false);
await a.waitForTimeout(6000);
const bCar = await b.evaluate(() => window.__dbg.play.car.position.toArray().map((n) => +n.toFixed(1)));
say('B roadster at', bCar);
say('A sees roadster at', await a.evaluate(() => window.__dbg.play.fleet[2].model.group.position.toArray().map((n) => +n.toFixed(1))));
say('A stats', await stats(a));
await a.evaluate(() => {
  const d = window.__dbg;
  const p = d.play.fleet[2].model.group.position;
  d.look(p.x + 6, p.y + 2.2, p.z - 6, p.x, p.y + 0.8, p.z);
});
await a.waitForTimeout(2500);
await a.screenshot({ path: `${out}-a-sees-b.png` });
await a.evaluate(() => (window.__dbg.play.game.cinematic = false));
await toDoor(a, 2);
await a.waitForTimeout(1000);
say('A prompt', await a.evaluate(() => document.getElementById('prompt').textContent));
await tap(a, 'KeyF');
await a.waitForTimeout(1500);
say('A mode', await a.evaluate(() => ({ mode: window.__dbg.play.game.mode, vehicle: window.__dbg.play.vehicle.index })));
say('A stats riding', await stats(a));
say('B sees', (await stats(b)).players);
await key(b, 'Space', true);
await a.waitForTimeout(4000);
await key(b, 'Space', false);
await a.waitForTimeout(4000);
say('B height', await b.evaluate(() => +window.__dbg.play.car.position.y.toFixed(1)));
say('A height while riding', await a.evaluate(() => +window.__dbg.play.player.state.position.y.toFixed(1)));
say('B stats', await stats(b));
say('A stats end', await stats(a));
say('A game', await a.evaluate(() => ({ mode: window.__dbg.play.game.mode, fps: window.__dbg.fps, err: window.__error || null })));
await a.screenshot({ path: `${out}-a-riding.png` });
await b.evaluate(() => {
  const d = window.__dbg;
  const p = d.play.car.position;
  d.look(p.x + 5, p.y + 1.6, p.z + 4.5, p.x, p.y + 0.7, p.z);
});
await b.waitForTimeout(2200);
await b.screenshot({ path: `${out}-b-sees-passenger.png` });
say('health', { a: await a.evaluate(() => window.__dbg.play.fleet.map((f) => +f.damage.state.health.toFixed(2))), b: await b.evaluate(() => window.__dbg.play.fleet.map((f) => +f.damage.state.health.toFixed(2))) });
console.log(logs.slice(-30).join('\n'));
await browser.close();
