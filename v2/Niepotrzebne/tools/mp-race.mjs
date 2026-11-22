// Costa del Gzowo: two real clients race the Bridge Sprint together and share the yacht; prints what each one sees.
// node mp-race.mjs <baseUrl> <outPrefix>
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const [base = 'http://localhost:8907/', out = 'mp-race'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--force_high_performance_gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
});
const logs = [];
async function client(tag, query) {
  const context = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) logs.push(`[${tag}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => logs.push(`[${tag} pageerror] ${e.message}`));
  await page.goto(`${base}?auto=1&quality=low&time=golden&world=w8&${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.mode === 'playing', null, { timeout: 240000 });
  return page;
}
const say = (label, value) => console.log(label, JSON.stringify(value));
const race = (page) => page.evaluate(() => {
  const d = window.__dbg;
  const s = d.ctx.races.state;
  return { phase: s.phase, cp: s.cp, startAt: s.startAt, time: s.time, frame: d.renderer.info.render.frame, sees: d.ctx.net ? d.ctx.net.racers().map((r) => `${r.name}:${r.course}/${r.phase}/${r.cp}`).join(' ') : '', bar: document.querySelector('.rc-bar').textContent, hint: document.querySelector('.rc-hint').textContent, results: document.querySelector('.rc-results').textContent, x: Math.round(d.play.car.position.x) };
});
const seat = (page, index, x, z) => page.evaluate(([i, px, pz]) => {
  const d = window.__dbg;
  if (d.npc) {
    d.npc.setTargets(0, 0);
    d.npc.peds.clear();
    d.npc.traffic.clear();
  }
  const item = d.play.fleet[i];
  d.play.activate(item);
  d.play.seat();
  if (d.ctx.net) d.ctx.net.claim(item);
  if (px !== null) {
    item.car.body.setTranslation({ x: px, y: 4.9, z: pz }, true);
    item.car.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }
}, [index, x, z]);
const press = (page, code) => page.evaluate((c) => window.__dbg.input.press(c), code);
const hold = (page, code, on) => page.evaluate(([c, o]) => window.__dbg.input.hold(c, o), [code, on]);

const a = await client('A', 'name=Ala');
const b = await client('B', 'name=Bob');
for (let i = 0; i < 40; i++) {
  const linked = await a.evaluate(() => !!window.__dbg.ctx.net && window.__dbg.ctx.net.stats().links.some((l) => l.open || l.relay));
  if (linked) break;
  await a.waitForTimeout(1000);
}
say('A net', await a.evaluate(() => (window.__dbg.ctx.net ? { world: window.__dbg.ctx.net.world, slot: window.__dbg.ctx.net.slot, owners: window.__dbg.ctx.net.owners } : null)));
say('B net', await b.evaluate(() => (window.__dbg.ctx.net ? { world: window.__dbg.ctx.net.world, slot: window.__dbg.ctx.net.slot, owners: window.__dbg.ctx.net.owners } : null)));
await seat(a, 0, -212, -2);
await seat(b, 1, -214, 2.2);
await a.waitForTimeout(3000);
for (const page of [a, b]) await page.evaluate(() => (window.__dbg.play.car.state.occupied = true));
await a.waitForTimeout(500);
say('A at line', await race(a));
await press(a, 'Enter');
await a.waitForTimeout(1200);
say('A staged', await race(a));
say('B sees', await race(b));
await press(b, 'Enter');
await b.waitForTimeout(1200);
say('B staged', await race(b));
say('A sees', await race(a));
await press(a, 'Enter');
await a.waitForTimeout(1500);
say('A countdown', await race(a));
say('B countdown', await race(b));
await a.waitForTimeout(3600);
const jump = (page, x, z) => page.evaluate(([px, pz]) => {
  const d = window.__dbg;
  const s = d.ctx.races.state;
  s.cp = d.ctx.races.courses[s.course].gates.length - 1;
  d.play.car.body.setTranslation({ x: px, y: 4.9, z: pz }, true);
  d.play.car.body.setLinvel({ x: 9, y: 0, z: 0 }, true);
}, [x, z]);
await jump(a, 226, -2);
await hold(a, 'KeyW', true);
await a.waitForTimeout(4000);
say('A mid', await race(a));
say('B mid', await race(b));
await jump(b, 222, 2.2);
await hold(b, 'KeyW', true);
for (let i = 0; i < 16; i++) {
  await a.waitForTimeout(2500);
  const [ra, rb] = [await race(a), await race(b)];
  if (ra.phase === 3 && rb.phase === 3) break;
}
await hold(a, 'KeyW', false);
await hold(b, 'KeyW', false);
await a.waitForTimeout(1500);
say('A end', await race(a));
say('B end', await race(b));
await a.screenshot({ path: `${out}-a-results.png` });

await press(a, 'Enter');
await press(b, 'Enter');
const yacht = await b.evaluate(() => window.__dbg.play.fleet.findIndex((f) => f.id === 'yacht'));
await b.evaluate(() => {
  window.__dbg.play.game.mode = 'foot';
  window.__dbg.play.car.state.occupied = false;
});
await seat(b, yacht, null, null);
await b.waitForTimeout(2500);
await b.evaluate((k) => {
  const item = window.__dbg.play.fleet[k];
  item.car.state.occupied = true;
  item.car.body.setTranslation({ x: 204, y: 0.4, z: 205 }, true);
}, yacht);
await b.waitForTimeout(5000);
const at = (page) => page.evaluate((k) => {
  const d = window.__dbg;
  const p = d.play.fleet[k].model.group.position;
  return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), remote: d.play.fleet[k].remote, driver: d.play.fleet[k].driver };
}, yacht);
say('yacht index', yacht);
say('B yacht', await at(b));
say('A sees yacht', await at(a));
for (const line of logs) console.log(line);
await browser.close();
