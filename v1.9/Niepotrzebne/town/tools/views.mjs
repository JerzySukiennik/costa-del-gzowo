// Costa del Gzowo town: builds a shot.mjs steps file that frames named views and measures frame cost at each.
// node views.mjs <out.json> <view> [view...]   (views from views.json next to this file)
import { writeFileSync, readFileSync } from 'node:fs';
const [out, ...names] = process.argv.slice(2);
const V = JSON.parse(readFileSync(new URL('./views.json', import.meta.url), 'utf8'));
const measure = (name, p) => `(async () => {
  const d = window.__dbg;
  d.look(${p.join(',')});
  const gl = d.renderer.getContext();
  const cam = d.camera.position;
  const ts = []; let calls = 0, tris = 0;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const queries = [];
  for (let i = 0; i < 26; i++) {
    d.renderer.info.reset();
    for (const c of d.ctx.cull) c.object.visible = (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 < c.range * c.range;
    d.trees.update(cam);
    if (d.ctx.town) d.ctx.town.update(1 / 60, 100 + i / 60, d.camera);
    d.ctx.grass.update(cam);
    d.lighting.update();
    const t0 = performance.now();
    let q = null;
    if (ext && i >= 8) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    d.pipeline.render(1 / 60, 100 + i / 60);
    if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(q); }
    gl.finish();
    if (i >= 8) { ts.push(performance.now() - t0); calls += d.renderer.info.render.calls; tris += d.renderer.info.render.triangles; }
  }
  ts.sort((a, b) => a - b);
  await new Promise((r) => setTimeout(r, 300));
  const gpu = queries.map((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) ? gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 : NaN).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  return { view: '${name}', ms: +ts[ts.length >> 1].toFixed(2), p90: +ts[Math.floor(ts.length * 0.9)].toFixed(2), calls: Math.round(calls / 18), mtris: +(tris / 18e6).toFixed(2), gpu: gpu.length ? +gpu[gpu.length >> 1].toFixed(2) : (ext ? 'n/a' : 'no ext') };
})()`;
const steps = [{ js: '0', wait: 2500 }, { js: 'window.requestAnimationFrame = () => 0; window.__keep = setInterval(() => window.__dbg.pipeline.render(1 / 60, 1), 2000)', wait: +(process.env.IDLE || 0) }];
for (const n of names) steps.push({ js: measure(n, V[n]), wait: 700, shot: n });
writeFileSync(out, JSON.stringify(steps));
