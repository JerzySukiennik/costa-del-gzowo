// Costa del Gzowo town: builds a shot.mjs steps file that frames named views and measures frame cost at each.
// node views.mjs <out.json> <view> [view...]   (views from views.json next to this file)
import { writeFileSync, readFileSync } from 'node:fs';
const [out, ...names] = process.argv.slice(2);
const V = JSON.parse(readFileSync(new URL('./views.json', import.meta.url), 'utf8'));
const measure = (name, p) => `(() => {
  const d = window.__dbg;
  d.look(${p.join(',')});
  const gl = d.renderer.getContext();
  const cam = d.camera.position;
  const ts = []; let calls = 0, tris = 0;
  for (let i = 0; i < 48; i++) {
    d.renderer.info.reset();
    for (const c of d.ctx.cull) c.object.visible = (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 < c.range * c.range;
    d.trees.update(cam);
    if (d.ctx.town) d.ctx.town.update(1 / 60, 100 + i / 60, d.camera);
    d.ctx.grass.update(cam);
    d.lighting.update();
    const t0 = performance.now();
    d.pipeline.render(1 / 60, 100 + i / 60);
    gl.finish();
    if (i >= 8) ts.push(performance.now() - t0);
    calls = d.renderer.info.render.calls; tris = d.renderer.info.render.triangles;
  }
  ts.sort((a, b) => a - b);
  return { view: '${name}', ms: +ts[ts.length >> 1].toFixed(2), p90: +ts[Math.floor(ts.length * 0.9)].toFixed(2), calls, tris };
})()`;
const steps = [{ js: '0', wait: 2500 }];
for (const n of names) steps.push({ js: measure(n, V[n]), wait: 700, shot: n });
writeFileSync(out, JSON.stringify(steps));
