// Riverside water harness: boots the stand-in world, the water system and the replica pipeline, and exposes window.__test helpers.
import * as THREE from 'three';
import { WaterSystem } from '../WaterSystem.js';
import { BRIDGE } from '../../config.js';
import { heightAt, flowAt, riverCenter, riverHalfWidth } from '../../world/heightfield.js';
import { buildTestScene } from './TestScene.js';
import { Pipeline } from './Pipeline.js';
import { FlyCamera } from './FlyCamera.js';
import { TestBody } from './TestBodies.js';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'ultra';

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2500);
  const world = await buildTestScene(renderer);
  const { scene } = world;
  scene.add(camera);

  const water = new WaterSystem({
    renderer,
    scene,
    camera,
    sunDirection: world.sunDirection,
    sunColor: world.sunColor,
    heightAt,
    flowAt,
    obstacles: world.obstacles,
    quality,
  });
  const t0 = performance.now();
  await water.init();
  const initMs = performance.now() - t0;
  water.setSunShadow(world.waterShadow.texture, world.waterShadow.matrix);

  const pipeline = new Pipeline(renderer, scene, camera, water);
  pipeline.setSize(window.innerWidth, window.innerHeight);
  const fly = new FlyCamera(camera, renderer.domElement);
  const bodies = [];
  let chase = null;
  let profiler = null;

  const groundY = (x, z) => Math.max(heightAt(x, z), 0);
  const views = {
    bridge: () => fly.lookAt(new THREE.Vector3(6, BRIDGE.deckY + 1.7, 5.6), new THREE.Vector3(10, 0, 60)),
    bridgeDown: () => fly.lookAt(new THREE.Vector3(10, BRIDGE.deckY + 1.7, 6.6), new THREE.Vector3(14, 0, 16)),
    bridgeUp: () => fly.lookAt(new THREE.Vector3(-4, BRIDGE.deckY + 1.7, -5.6), new THREE.Vector3(-8, 0, -60)),
    bank: () => {
      const z = 34;
      const x = riverCenter(z) - riverHalfWidth(z) - 1.5;
      fly.lookAt(new THREE.Vector3(x, groundY(x, z) + 1.7, z), new THREE.Vector3(riverCenter(5) + 8, 1.0, 2));
    },
    bankSun: () => {
      const z = 30;
      const s = world.sunDirection;
      const x = riverCenter(z) + Math.sign(-s.x || 1) * (riverHalfWidth(z) + 1);
      const p = new THREE.Vector3(x, groundY(x, z) + 1.7, z);
      fly.lookAt(p, p.clone().add(new THREE.Vector3(s.x, 0, s.z).normalize().multiplyScalar(40)).setY(-2));
    },
    surface: () => fly.lookAt(new THREE.Vector3(9, 0.35, 32), new THREE.Vector3(6, 2.5, 0)),
    waterline: () => fly.lookAt(new THREE.Vector3(9, 0.0, 30), new THREE.Vector3(6, 0.4, 0)),
    underwater: () => fly.lookAt(new THREE.Vector3(9, -1.7, 24), new THREE.Vector3(3, -1.2, 3)),
    underUp: () => fly.lookAt(new THREE.Vector3(9, -2.2, 20), new THREE.Vector3(9.5, 2, 16)),
    drop: () => fly.lookAt(new THREE.Vector3(-6, 3.2, 26), new THREE.Vector3(8, 0.3, 8)),
    dropClose: () => fly.lookAt(new THREE.Vector3(1, 2.2, 17), new THREE.Vector3(8, 0.2, 8)),
    ramp: () => fly.lookAt(new THREE.Vector3(-22, 4.5, 92), new THREE.Vector3(-2, 0, 78)),
    chase: () => {
      chase = bodies.find((b) => b.vehicle) || null;
    },
    aerial: () => fly.lookAt(new THREE.Vector3(-40, 45, -60), new THREE.Vector3(5, 0, 20)),
  };

  const test = {
    water,
    camera,
    world,
    pipeline,
    initMs,
    view(name) {
      chase = null;
      views[name]?.();
      return name;
    },
    look(px, py, pz, tx, ty, tz) {
      chase = null;
      fly.lookAt(new THREE.Vector3(px, py, pz), new THREE.Vector3(tx, ty, tz));
    },
    drop(kind = 'character', x = 8, z = 7.6) {
      const b = new TestBody(kind, scene);
      if (kind === 'vehicle') {
        b.position.set(x, BRIDGE.deckY + 1.6, z - 1);
        b.velocity.set(0.5, 1.0, 4.5);
        b.quaternion.setFromEuler(new THREE.Euler(0.2, 0, 0));
      } else {
        b.position.set(x, BRIDGE.deckY + 2.2, z - 1.2);
        b.velocity.set(0.2, 2.5, 1.4);
      }
      bodies.push(b);
      return b.id;
    },
    wade() {
      const b = new TestBody('vehicle', scene);
      const pts = [[-40, 70], [-24, 74.5], [-10, 77.6], [2, 80], [16, 84], [30, 90]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      b.position.set(pts[0].x, heightAt(pts[0].x, pts[0].z) + 0.71, pts[0].z);
      b.followPath(pts, 4.5);
      bodies.push(b);
      chase = b;
      return b.id;
    },
    swim() {
      const b = new TestBody('character', scene);
      const z = 40;
      const x0 = riverCenter(z) - riverHalfWidth(z) + 2;
      const pts = [new THREE.Vector3(x0, 0, z), new THREE.Vector3(x0 + 30, 0, z + 6)];
      b.position.set(x0, heightAt(x0, z) + 0.9, z);
      b.followPath(pts, 1.3);
      bodies.push(b);
      return b.id;
    },
    clear() {
      bodies.forEach((b) => b.dispose());
      bodies.length = 0;
      chase = null;
    },
    profile() {
      const gl = renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return 'no timer query';
      profiler = { gl, ext, samples: { update: [], reflection: [], frame: [] }, pending: [] };
      return 'ok';
    },
    profileResult() {
      if (!profiler) return null;
      const avg = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null);
      return { update: avg(profiler.samples.update), reflection: avg(profiler.samples.reflection), frame: avg(profiler.samples.frame), n: profiler.samples.frame.length };
    },
    setWater(on) {
      pipeline.waterEnabled = !!on;
      return pipeline.waterEnabled;
    },
    frameTime(ms = 1500) {
      return new Promise((resolve) => {
        const t0 = performance.now();
        let n = 0;
        const tick = () => {
          n++;
          const t = performance.now() - t0;
          if (t < ms) requestAnimationFrame(tick);
          else resolve(+(t / n).toFixed(2));
        };
        requestAnimationFrame(tick);
      });
    },
    stats() {
      return { fps: fpsAvg, initMs, spray: water.spray.count, bubbles: water.bubbles.count, under: water.cameraUnderwater, uw: water.underwaterPass.enabled };
    },
  };
  window.__test = test;
  views[params.get('view') || 'bridge']();

  let last = performance.now();
  let elapsed = 0;
  let fpsAvg = 0;
  let frames = 0;
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    fly.update(dt);
    for (const b of bodies) b.update(dt, water);
    if (chase) {
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(chase.quaternion);
      fwd.y = 0;
      fwd.normalize();
      const pos = chase.position.clone().addScaledVector(fwd, -7.5).add(new THREE.Vector3(0, 2.6, 0));
      pos.y = Math.max(pos.y, heightAt(pos.x, pos.z) + 0.8);
      fly.lookAt(pos, chase.position.clone().addScaledVector(fwd, 4).add(new THREE.Vector3(0, 0.5, 0)));
    }
    water.setInteractors(bodies.filter((b) => b.submersion > 0).map((b) => b.interactor()));
    if (profiler) {
      const { gl, ext } = profiler;
      for (let i = profiler.pending.length - 1; i >= 0; i--) {
        const [key, q] = profiler.pending[i];
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
          profiler.samples[key].push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
          profiler.pending.splice(i, 1);
        }
      }
      const timed = (key, fn) => {
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        fn();
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        profiler.pending.push([key, q]);
      };
      const origUpdate = water.update.bind(water);
      const origRefl = water.renderReflection.bind(water);
      water.update = (...a) => timed('update', () => origUpdate(...a));
      water.renderReflection = (...a) => timed('reflection', () => origRefl(...a));
      const t0 = performance.now();
      pipeline.render(dt, elapsed);
      profiler.samples.cpu = profiler.samples.cpu || [];
      profiler.samples.cpu.push(performance.now() - t0);
      water.update = origUpdate;
      water.renderReflection = origRefl;
    } else {
      pipeline.render(dt, elapsed);
    }
    frames++;
    if (frames === 2) window.__ready = true;
    requestAnimationFrame(loop);
  };
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    pipeline.setSize(window.innerWidth, window.innerHeight);
  });
  loop();
}

main().catch((e) => {
  console.error(e);
  window.__error = String(e && e.stack ? e.stack : e);
});
