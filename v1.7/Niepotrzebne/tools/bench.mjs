// Costa del Gzowo: frame-time benchmark in headless Chrome on the real GPU; stops the game's own loop and renders fixed views frame by frame, each frame forced to finish on the GPU.
// node bench.mjs <url> <out.json> [q=ultra,high] [views=spawn,town] [frames=24] [size=1728x1000@2] [shots=dir] [probe=1] [js=...] [cool=6]
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');
const { VIEWS } = await import(new URL('../../src/dev/benchViews.js', import.meta.url).href);

const [url, outFile, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((s) => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]));
const qualities = (opt.q || 'ultra').split(',');
const frames = +(opt.frames || 24);
const [, sw, sh, sd] = /^(\d+)x(\d+)@([\d.]+)$/.exec(opt.size || '1728x1000@2');
const cool = +(opt.cool ?? 6) * 1000;

const views = (opt.views || Object.keys(VIEWS).join(',')).split(',');

function harness() {
  const d = window.__dbg;
  window.requestAnimationFrame = () => 0;
  const gl = d.renderer.getContext();
  const px = new Uint8Array(4);
  let time = 100;
  const old = (dt) => {
    const { renderer, ctx, play, trees, lighting, pipeline, camera } = d;
    renderer.info.reset();
    ctx.time.value = time;
    play.update(dt, time);
    if (play.game.cinematic) ctx.grass.update(camera.position);
    trees.update(camera.position);
    ctx.town.update(dt, time, camera);
    for (const c of ctx.cull) c.object.visible = (c.x - camera.position.x) ** 2 + (c.z - camera.position.z) ** 2 < c.range * c.range;
    lighting.update();
    pipeline.render(dt, time);
  };
  const body = d.step ? (dt) => d.step(dt, time) : old;
  const frame = (dt = 1 / 60) => {
    time += dt;
    const t0 = performance.now();
    body(dt);
    const t1 = performance.now();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [performance.now() - t0, t1 - t0];
  };
  const channel = new MessageChannel();
  let wake = null;
  channel.port1.onmessage = () => wake && wake();
  const pause = () => new Promise((resolve) => {
    wake = resolve;
    channel.port2.postMessage(0);
  });
  const run = async (frames, warm = 6) => {
    for (let i = 0; i < warm; i++) {
      frame();
      await pause();
    }
    const ts = [];
    const cs = [];
    let calls = 0;
    let tris = 0;
    for (let i = 0; i < frames; i++) {
      await pause();
      const [t, c] = frame();
      ts.push(t);
      cs.push(c);
      calls += d.renderer.info.render.calls;
      tris += d.renderer.info.render.triangles;
    }
    ts.sort((a, b) => a - b);
    cs.sort((a, b) => a - b);
    const cut = ts.slice(2, -2);
    return { ms: cut.reduce((a, b) => a + b, 0) / cut.length, best: ts[0], cpu: cs[cs.length >> 1], calls: Math.round(calls / frames), tris: Math.round(tris / frames) };
  };
  let heightAt = null;
  const view = async (v) => {
    if (!v.cam) d.play.game.cinematic = false;
    else {
      const c = v.cam.slice();
      if (v.ground) {
        if (!heightAt) heightAt = (await import(new URL('src/world/heightfield.js', location.href).href)).heightAt;
        c[1] = heightAt(c[0], c[2]) + v.ground;
        c[4] = heightAt(c[3], c[5]) + v.ground + 1.5;
      }
      d.look(...c);
      d.camera.fov = v.fov || 60;
      d.camera.updateProjectionMatrix();
    }
    time = 100;
    d.pipeline.frame = 0;
    d.pipeline.reset = true;
  };
  const info = () => {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', size: [d.pipeline.width, d.pipeline.height] };
  };
  const shot = () => d.renderer.domElement.toDataURL('image/png');
  const speedups = (on) => {
    if (d.perf) for (const key of Object.keys(d.perf)) d.perf[key] = on;
  };
  const still = async (count) => {
    time = 100;
    d.pipeline.frame = 0;
    d.pipeline.reset = true;
    for (let i = 0; i < count; i++) {
      await pause();
      frame();
    }
    return shot();
  };
  window.__bench = { d, frame, run, view, info, shot, pause, speedups, still };
}

async function probe(frames) {
  const { d, run } = window.__bench;
  const count = (m) => {
    const g = m.geometry;
    const c = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
    const inst = m.isInstancedMesh ? m.count : g.isInstancedBufferGeometry ? (g.instanceCount === Infinity ? 1 : g.instanceCount) : 1;
    return (c / 3) * inst;
  };
  const named = (name) => d.scene.children.filter((c) => (c.name || c.type) === name);
  const hide = (...names) => () => {
    const list = names.flatMap(named).filter((o) => o.visible);
    list.forEach((o) => (o.visible = false));
    return () => list.forEach((o) => (o.visible = true));
  };
  const flag = (key) => () => {
    d.pipeline.settings[key] = false;
    return () => {
      d.pipeline.settings[key] = true;
      d.pipeline.reset = true;
    };
  };
  const stub = (object, key) => () => {
    const f = object[key];
    object[key] = () => {};
    return () => (object[key] = f);
  };
  const rescale = (k) => () => {
    const s = d.pipeline.settings.scale;
    const size = () => d.pipeline.setSize(innerWidth, innerHeight, d.renderer.getPixelRatio());
    d.pipeline.settings.scale = s * k;
    size();
    return () => {
      d.pipeline.settings.scale = s;
      size();
    };
  };
  const toggles = {
    'no AO': flag('ao'), 'no fog': flag('fog'), 'no motion blur': flag('motion'), 'no TAA + motion': flag('taa'),
    'no shadow pass': stub(d.renderer.shadowMap, 'render'), 'no reflection': stub(d.water, 'renderReflection'), 'no water update': stub(d.water, 'update'),
    'quarter pixels': rescale(0.5),
    'hide trees': hide('trees'), 'hide plants': hide('plants'), 'hide grass': hide('Mesh', 'grass'), 'hide terrain': hide('terrain'), 'hide player': hide('player'),
    'hide vehicles': hide('roadster', 'car', 'helicopter'), 'hide town': hide('town'), 'hide water': hide('WaterSystem'),
  };
  const rows = [];
  let base = await run(frames, 8);
  rows.push(['base', base, base]);
  let i = 0;
  for (const [name, apply] of Object.entries(toggles)) {
    const undo = apply();
    const r = await run(frames, 4);
    undo();
    if (++i % 3 === 0) base = await run(frames, 4);
    rows.push([name, r, base]);
  }
  const end = await run(frames, 4);
  rows.push(['base again', end, end]);
  const groups = d.scene.children.map((c) => {
    let n = 0;
    let meshes = 0;
    c.traverse((m) => {
      if ((m.isMesh || m.isPoints) && m.geometry) {
        n += count(m);
        meshes++;
      }
    });
    return [c.name || c.type, Math.round(n), meshes];
  }).sort((a, b) => b[1] - a[1]).slice(0, 14);
  return { rows, groups };
}

async function counts() {
  const { d, frame, pause } = window.__bench;
  const info = d.renderer.info.render;
  const pass = { shadow: [0, 0], reflection: [0, 0] };
  const wrap = (object, key, slot) => {
    const f = object[key];
    object[key] = function (...a) {
      const c = info.calls;
      const t = info.triangles;
      const r = f.apply(this, a);
      pass[slot][0] += info.calls - c;
      pass[slot][1] += info.triangles - t;
      return r;
    };
    return () => (object[key] = f);
  };
  const named = (name) => d.scene.children.filter((c) => (c.name || c.type) === name);
  const sample = async (hidden) => {
    const list = hidden.flatMap(named).filter((o) => o.visible);
    list.forEach((o) => (o.visible = false));
    pass.shadow = [0, 0];
    pass.reflection = [0, 0];
    let calls = 0;
    let tris = 0;
    for (let i = 0; i < 6; i++) {
      frame();
      calls += info.calls;
      tris += info.triangles;
      await pause();
    }
    list.forEach((o) => (o.visible = true));
    const k = (v) => Math.round(v / 6);
    return { calls: k(calls), tris: k(tris), shadowCalls: k(pass.shadow[0]), shadowTris: k(pass.shadow[1]), reflCalls: k(pass.reflection[0]), reflTris: k(pass.reflection[1]) };
  };
  for (let i = 0; i < 18; i++) {
    frame();
    await pause();
  }
  const undo = [wrap(d.renderer.shadowMap, 'render', 'shadow'), wrap(d.water, 'renderReflection', 'reflection')];
  const out = { all: await sample([]) };
  const sets = { trees: ['trees'], grass: ['Mesh', 'grass'], plants: ['plants'], terrain: ['terrain'], player: ['player'], vehicles: ['roadster', 'car', 'helicopter'], town: ['town'] };
  for (const [name, hidden] of Object.entries(sets)) {
    const r = await sample(hidden);
    out[name] = Object.fromEntries(Object.keys(r).map((key) => [key, out.all[key] - r[key]]));
  }
  undo.forEach((f) => f());
  const seen = new Map();
  d.trees.group.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry;
    const e = seen.get(g.uuid) || { tris: Math.round((g.index ? g.index.count : g.attributes.position.count) / 3), meshes: 0, instances: 0, shown: 0 };
    e.meshes++;
    e.instances += m.isInstancedMesh ? m.count : 1;
    let o = m;
    let on = true;
    while (o) {
      if (!o.visible) on = false;
      o = o.parent;
    }
    if (on) e.shown += m.isInstancedMesh ? m.count : 1;
    seen.set(g.uuid, e);
  });
  out.treeGeometries = [...seen.values()].sort((a, b) => b.tris * b.shown - a.tris * a.shown).slice(0, 16);
  const people = [];
  d.scene.traverse((m) => {
    if (m.isSkinnedMesh) people.push(Math.round((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3));
  });
  out.skinned = { meshes: people.length, tris: people.reduce((a, b) => a + b, 0) };
  return out;
}

async function shadowSplit() {
  const { d, frame, pause } = window.__bench;
  const r = d.renderer;
  const draw = r.renderBufferDirect;
  const shadow = r.shadowMap.render;
  const sums = new Map();
  let inside = false;
  r.shadowMap.render = function (...a) {
    inside = true;
    const out = shadow.apply(this, a);
    inside = false;
    return out;
  };
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (inside) {
      let top = object;
      while (top.parent && top.parent !== d.scene) top = top.parent;
      const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      const n = object.isInstancedMesh ? object.count : 1;
      const key = `${(top.name || top.type).padEnd(12)} ${object.isInstancedMesh ? 'instanced' : object.isSkinnedMesh ? 'skinned  ' : 'mesh     '} ${String(Math.round(tris)).padStart(7)} tris x${String(n).padStart(4)}`;
      const e = sums.get(key) || [0, 0];
      e[0] += tris * n;
      e[1]++;
      sums.set(key, e);
    }
    return draw.call(this, camera, scene, geometry, material, object, group);
  };
  for (let i = 0; i < 6; i++) {
    frame();
    await pause();
  }
  sums.clear();
  for (let i = 0; i < 6; i++) {
    frame();
    await pause();
  }
  r.renderBufferDirect = draw;
  r.shadowMap.render = shadow;
  return [...sums.entries()].map(([key, e]) => [key, Math.round(e[0] / 6), +(e[1] / 6).toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 26);
}

async function driveTest({ frames, start }) {
  const { d, frame, pause } = window.__bench;
  const { heightAt } = await import(new URL('src/world/heightfield.js', location.href).href);
  d.play.game.cinematic = false;
  d.play.seat();
  const car = d.play.car;
  car.body.setTranslation({ x: start[0], y: heightAt(start[0], start[1]) + 0.9, z: start[1] }, true);
  car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  const spots = [
    ['logic', d.play, 'update'], ['trees', d.trees, 'update'], ['grassCull', d.ctx.grass, 'cull'], ['lod', d.lod, 'update'], ['lodEnd', d.lod, 'end'], ['modelCull', d.modelCull, 'update'],
    ['waterUpdate', d.water, 'update'], ['reflection', d.water, 'renderReflection'], ['shadows', d.renderer.shadowMap, 'render'], ['renders', d.renderer, 'render'], ['pipeline', d.pipeline, 'render'],
  ];
  const now = {};
  const undo = [];
  for (const [label, object, key] of spots) {
    if (!object || typeof object[key] !== 'function') continue;
    const original = object[key];
    now[label] = 0;
    object[key] = function (...a) {
      const t = performance.now();
      const r = original.apply(this, a);
      now[label] += performance.now() - t;
      return r;
    };
    undo.push(() => (object[key] = original));
  }
  for (let i = 0; i < 20; i++) {
    frame();
    await pause();
  }
  d.input.hold('KeyW', true);
  const rows = [];
  const info = d.renderer.info;
  let programs = info.programs.length;
  let geometries = info.memory.geometries;
  let textures = info.memory.textures;
  for (let i = 0; i < frames; i++) {
    if (i % 150 === 60) d.input.hold('KeyA', true);
    if (i % 150 === 85) d.input.hold('KeyA', false);
    if (i % 150 === 130) d.input.hold('KeyD', true);
    if (i % 150 === 149) d.input.hold('KeyD', false);
    for (const key of Object.keys(now)) now[key] = 0;
    const [total, cpu] = frame();
    rows.push({ i, total, cpu, parts: { ...now }, programs: info.programs.length - programs, geometries: info.memory.geometries - geometries, textures: info.memory.textures - textures, speed: car.state.speed, x: car.position.x, z: car.position.z, calls: info.render.calls });
    programs = info.programs.length;
    geometries = info.memory.geometries;
    textures = info.memory.textures;
    await pause();
  }
  d.input.hold('KeyW', false);
  undo.forEach((f) => f());
  const sorted = rows.map((r) => r.cpu).sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const worst = rows.slice().sort((a, b) => b.cpu - a.cpu).slice(0, 10);
  const last = rows[rows.length - 1];
  return {
    median, p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1], over2x: rows.filter((r) => r.cpu > median * 2).length,
    end: [last.x, last.z, last.speed], topSpeed: Math.max(...rows.map((r) => r.speed)),
    worst: worst.map((r) => ({ frame: r.i, cpu: +r.cpu.toFixed(1), total: +r.total.toFixed(1), speed: +r.speed.toFixed(1), programs: r.programs, geometries: r.geometries, textures: r.textures, parts: Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, +v.toFixed(1)])) })),
  };
}

async function cpuSplit(frames) {
  const { d, frame, pause } = window.__bench;
  const spots = [
    ['game logic and physics', d.play, 'update'], ['trees', d.trees, 'update'], ['town', d.ctx.town, 'update'], ['grass tiles', d.ctx.grass, 'cull'], ['lighting', d.lighting, 'update'],
    ['water update', d.water, 'update'], ['reflection pass', d.water, 'renderReflection'], ['shadow pass', d.renderer.shadowMap, 'render'], ['all three.js renders', d.renderer, 'render'], ['whole pipeline', d.pipeline, 'render'],
  ];
  const sums = {};
  const undo = [];
  for (const [label, object, key] of spots) {
    if (!object || typeof object[key] !== 'function') continue;
    const original = object[key];
    sums[label] = 0;
    object[key] = function (...a) {
      const t = performance.now();
      const r = original.apply(this, a);
      sums[label] += performance.now() - t;
      return r;
    };
    undo.push(() => (object[key] = original));
  }
  for (let i = 0; i < 8; i++) {
    frame();
    await pause();
  }
  for (const key of Object.keys(sums)) sums[key] = 0;
  let total = 0;
  for (let i = 0; i < frames; i++) {
    total += frame()[1];
    await pause();
  }
  undo.forEach((f) => f());
  const out = { 'frame (CPU side)': total / frames };
  for (const [key, value] of Object.entries(sums)) out[key] = value / frames;
  return out;
}

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--force_high_performance_gpu',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
});
async function open(target, quality) {
  const page = await browser.newPage({ viewport: { width: +sw, height: +sh }, deviceScaleFactor: +sd });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300));
  });
  const sep = target.includes('?') ? '&' : '?';
  await page.goto(`${target}${sep}auto=1&solo=1&quality=${quality}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 120000, polling: 250 });
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await page.waitForFunction(() => window.__dbg && window.__dbg.mode !== 'title', null, { timeout: 6000, polling: 250 });
      break;
    } catch (error) {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        setTimeout(() => document.activeElement && document.activeElement.click && document.activeElement.click(), 150);
      });
    }
  }
  await page.waitForFunction(() => window.__dbg && window.__dbg.mode === 'playing', null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(1800);
  await page.evaluate(harness);
  if (opt.wait) await page.evaluate(async (ms) => {
    const until = performance.now() + ms;
    while (performance.now() < until && window.__dbg.lod && window.__dbg.lod.stats.pending > 0) await new Promise((r) => setTimeout(r, 100));
  }, +opt.wait);
  return page;
}

const out = { url, size: `${sw}x${sh}@${sd}`, frames, runs: [] };
if (opt.shots) mkdirSync(opt.shots, { recursive: true });
if (opt.vs) {
  for (const quality of qualities) {
    const before = await open(opt.vs, quality);
    const after = await open(url, quality);
    const run = { quality, ...(await after.evaluate(() => window.__bench.info())), views: {} };
    for (const name of views) {
      for (const page of [before, after]) await page.evaluate((view) => window.__bench.view(view), VIEWS[name]);
      const sum = { old: [], new: [] };
      for (const side of ['old', 'new', 'new', 'old']) sum[side].push(await (side === 'old' ? before : after).evaluate((n) => window.__bench.run(n, 10), frames));
      const mean = (list) => ({ ...list[0], ms: (list[0].ms + list[1].ms) / 2, cpu: (list[0].cpu + list[1].cpu) / 2 });
      const o = mean(sum.old);
      const n = mean(sum.new);
      run.views[name] = { old: o, new: n };
      console.log(`${quality.padEnd(10)} ${name.padEnd(9)} old ${o.ms.toFixed(1).padStart(6)} ms (${(1000 / o.ms).toFixed(1)} fps, ${(o.tris / 1e6).toFixed(1)}M tris, ${o.calls} calls, cpu ${o.cpu.toFixed(1)})  new ${n.ms.toFixed(1).padStart(6)} ms (${(1000 / n.ms).toFixed(1)} fps, ${(n.tris / 1e6).toFixed(1)}M tris, ${n.calls} calls, cpu ${n.cpu.toFixed(1)})  gain ${((o.ms / n.ms - 1) * 100).toFixed(0)}%`);
      if (opt.shots && VIEWS[name].cam) {
        for (const [side, page] of [['old', before], ['new', after]]) {
          const data = await page.evaluate(() => window.__bench.still(20));
          writeFileSync(`${opt.shots}/${quality}-${name}-${side}.png`, Buffer.from(data.split(',')[1], 'base64'));
        }
      }
    }
    out.runs.push(run);
    await before.close();
    await after.close();
    if (quality !== qualities[qualities.length - 1]) await new Promise((r) => setTimeout(r, cool));
  }
  if (outFile && outFile !== '-') writeFileSync(outFile, JSON.stringify(out, null, 1));
  await browser.close();
  process.exit(0);
}
if (opt.drive) {
  const start = (opt.start || '-150,80').split(',').map(Number);
  for (const quality of qualities) {
    const page = await open(url, quality);
    const r = await page.evaluate(driveTest, { frames, start });
    console.log(`\n== ${quality} drive from ${start.join(',')}: CPU per frame median ${r.median.toFixed(1)} ms, p95 ${r.p95.toFixed(1)}, max ${r.max.toFixed(1)}, frames over 2x median: ${r.over2x} of ${frames}; top speed ${r.topSpeed.toFixed(1)} m/s, ended at ${r.end.map((v) => v.toFixed(0)).join(', ')}`);
    for (const w of r.worst) console.log(`  frame ${String(w.frame).padStart(4)}  cpu ${String(w.cpu).padStart(6)} ms  speed ${String(w.speed).padStart(5)}  new programs ${w.programs} geometries ${w.geometries} textures ${w.textures}  ${JSON.stringify(w.parts)}`);
    await page.close();
  }
  await browser.close();
  process.exit(0);
}
for (const quality of qualities) {
  const page = await browser.newPage({ viewport: { width: +sw, height: +sh }, deviceScaleFactor: +sd });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300));
  });
  const sep = url.includes('?') ? '&' : '?';
  await page.goto(`${url}${sep}auto=1&solo=1&quality=${quality}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 120000, polling: 250 });
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await page.waitForFunction(() => window.__dbg && window.__dbg.mode !== 'title', null, { timeout: 6000, polling: 250 });
      break;
    } catch (error) {
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        setTimeout(() => document.activeElement && document.activeElement.click && document.activeElement.click(), 150);
      });
    }
  }
  await page.waitForFunction(() => window.__dbg && window.__dbg.mode === 'playing', null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(1800);
  await page.evaluate(harness);
  if (opt.js) await page.evaluate(opt.js);
  if (opt.speedups) await page.evaluate((on) => window.__bench.speedups(on), opt.speedups !== '0');
  if (opt.wait) await page.evaluate(async (ms) => {
    const until = performance.now() + ms;
    while (performance.now() < until && window.__dbg.lod && window.__dbg.lod.stats.pending > 0) await new Promise((r) => setTimeout(r, 100));
  }, +opt.wait);
  const run = { quality, ...(await page.evaluate(() => window.__bench.info())), views: {} };
  for (const name of views) {
    const v = VIEWS[name];
    await page.evaluate((view) => window.__bench.view(view), v);
    if (opt.shadowsplit) {
      const rows = await page.evaluate(shadowSplit);
      console.log(`\n== ${quality} / ${name} shadow pass (triangles per frame, draws per frame)`);
      for (const [key, tris, draws] of rows) console.log(`  ${key}  ${(tris / 1e6).toFixed(3).padStart(7)}M  ${String(draws).padStart(5)}`);
    } else if (opt.cpu) {
      const split = await page.evaluate(cpuSplit, frames);
      run.views[name] = split;
      console.log(`\n== ${quality} / ${name} (CPU milliseconds per frame)`);
      for (const [label, value] of Object.entries(split)) console.log(`  ${label.padEnd(26)} ${value.toFixed(2).padStart(7)}`);
    } else if (opt.counts) {
      const c = await page.evaluate(counts);
      run.views[name] = c;
      const row = (label, r) => console.log(`  ${label.padEnd(9)} total ${String(r.calls).padStart(5)} calls ${(r.tris / 1e6).toFixed(2).padStart(6)}M | shadow ${String(r.shadowCalls).padStart(5)} calls ${(r.shadowTris / 1e6).toFixed(2).padStart(6)}M | reflection ${String(r.reflCalls).padStart(5)} calls ${(r.reflTris / 1e6).toFixed(2).padStart(6)}M`);
      console.log(`\n== ${quality} / ${name}`);
      for (const [label, r] of Object.entries(c)) if (r && r.calls !== undefined) row(label, r);
      if (name === views[0]) {
        console.log('  tree geometries (triangles, meshes, instances, shown now):');
        for (const g of c.treeGeometries) console.log(`    ${String(g.tris).padStart(8)} ${String(g.meshes).padStart(5)} ${String(g.instances).padStart(6)} ${String(g.shown).padStart(6)}`);
        console.log('  skinned meshes:', JSON.stringify(c.skinned));
      }
    } else if (opt.ab) {
      const pair = {};
      for (const mode of ['off', 'on', 'on2', 'off2']) {
        await page.evaluate((on) => window.__bench.speedups(on), mode.startsWith('on'));
        pair[mode] = await page.evaluate((n) => window.__bench.run(n, 12), frames);
      }
      const off = (pair.off.ms + pair.off2.ms) / 2;
      const on = (pair.on.ms + pair.on2.ms) / 2;
      run.views[name] = { off: { ...pair.off, ms: off }, on: { ...pair.on, ms: on } };
      console.log(`${quality.padEnd(10)} ${name.padEnd(9)} off ${off.toFixed(1).padStart(6)} ms (${(1000 / off).toFixed(1)} fps, ${(pair.off.tris / 1e6).toFixed(1)}M tris, ${pair.off.calls} calls, cpu ${pair.off.cpu.toFixed(1)})  on ${on.toFixed(1).padStart(6)} ms (${(1000 / on).toFixed(1)} fps, ${(pair.on.tris / 1e6).toFixed(1)}M tris, ${pair.on.calls} calls, cpu ${pair.on.cpu.toFixed(1)})  gain ${((off / on - 1) * 100).toFixed(0)}%`);
      if (opt.shots && VIEWS[name].cam) {
        for (const mode of ['off', 'on']) {
          await page.evaluate((on) => window.__bench.speedups(on), mode === 'on');
          const data = await page.evaluate(() => window.__bench.still(20));
          writeFileSync(`${opt.shots}/${quality}-${name}-${mode}.png`, Buffer.from(data.split(',')[1], 'base64'));
        }
      }
    } else if (opt.probe) {
      await page.evaluate(() => window.__bench.run(4, 10));
      const r = await page.evaluate(probe, frames);
      run.views[name] = r.rows[0][1];
      const b = r.rows[0][1];
      console.log(`\n== ${quality} / ${name}: ${b.ms.toFixed(1)} ms (${(1000 / b.ms).toFixed(1)} fps), cpu ${b.cpu.toFixed(1)} ms, calls ${b.calls}, tris ${(b.tris / 1e6).toFixed(2)}M  [${run.gpu} ${run.size.join('x')}]`);
      for (const [label, m, base] of r.rows.slice(1)) {
        console.log(`  ${label.padEnd(17)} ${m.ms.toFixed(1).padStart(6)} ms vs ${base.ms.toFixed(1).padStart(6)}  saves ${(base.ms - m.ms).toFixed(1).padStart(6)} ms (${(((base.ms - m.ms) / base.ms) * 100).toFixed(0).padStart(3)}%)  cpu ${m.cpu.toFixed(1).padStart(5)}  calls ${String(m.calls).padStart(5)}  tris ${(m.tris / 1e6).toFixed(2)}M`);
      }
      if (name === views[0]) {
        console.log('  scene groups (triangles, meshes):');
        for (const g of r.groups) console.log(`    ${String(g[0]).padEnd(20)} ${String(g[1]).padStart(10)} ${String(g[2]).padStart(5)}`);
      }
    } else {
      const m = await page.evaluate((n) => window.__bench.run(n, 10), frames);
      run.views[name] = m;
      console.log(`${quality.padEnd(10)} ${name.padEnd(9)} ${m.ms.toFixed(1).padStart(6)} ms  ${(1000 / m.ms).toFixed(1).padStart(5)} fps  cpu ${m.cpu.toFixed(1).padStart(5)} ms  calls ${String(m.calls).padStart(5)}  tris ${(m.tris / 1e6).toFixed(2)}M`);
    }
    if (opt.shots && !opt.ab) {
      const data = await page.evaluate(() => window.__bench.still(20));
      writeFileSync(`${opt.shots}/${quality}-${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
    }
  }
  out.runs.push(run);
  await page.close();
  if (quality !== qualities[qualities.length - 1]) await new Promise((r) => setTimeout(r, cool));
}
if (outFile && outFile !== '-') writeFileSync(outFile, JSON.stringify(out, null, 1));
await browser.close();
