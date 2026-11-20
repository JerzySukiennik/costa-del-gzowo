// Riverside: bootstrap, loading flow, settings and the main loop.
import * as THREE from 'three';
import { LAYERS, WATER_OBSTACLES } from './config.js';
import { Assets } from './core/assets.js';
import { createPhysics } from './core/physics.js';
import { createInput } from './core/input.js';
import { Pipeline } from './render/pipeline.js';
import { createLighting } from './render/lighting.js';
import { createTerrain } from './world/terrain.js';
import { createBridge } from './world/bridge.js';
import { createTrees } from './world/trees.js';
import { createPlants } from './world/plants.js';
import { createGrass } from './world/grass.js';
import { createProps } from './world/props.js';
import { createSkyline } from './world/skyline.js';
import { createFallbackWater } from './world/fallbackWater.js';
import { heightAt, flowAt } from './world/heightfield.js';
import { createGame } from './game.js';
import { createAudio } from './audio/audio.js';

const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
const statusEl = document.getElementById('boot-status');
const fillEl = document.getElementById('boot-fill');
const goEl = document.getElementById('boot-go');
const bootEl = document.getElementById('boot');
const menuEl = document.getElementById('menu');
const QUALITY = { ultra: { ratio: 1.25, scale: 1 }, high: { ratio: 1, scale: 1 }, medium: { ratio: 1, scale: 0.72 } };

const status = (text) => (statusEl.textContent = text);
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function startWater(ctx, obstacles) {
  try {
    const module = await import('./water/WaterSystem.js');
    const water = new module.WaterSystem({
      renderer: ctx.renderer, scene: ctx.scene, camera: ctx.camera, sunDirection: ctx.lighting.sunDirection, sunColor: ctx.lighting.sunColor,
      heightAt, flowAt, obstacles, quality: ctx.quality,
    });
    await water.init();
    return water;
  } catch (error) {
    console.warn('Water system unavailable, using fallback surface.', error);
    return createFallbackWater(ctx);
  }
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.12, 4000);
  camera.layers.enable(LAYERS.DETAIL);
  const assets = new Assets(renderer);
  assets.onProgress = (done, total) => (fillEl.style.width = `${Math.round((done / Math.max(total, 1)) * 92)}%`);
  const input = createInput(canvas);
  let quality = params.get('quality') || localStorage.getItem('riverside-quality') || 'ultra';
  if (!QUALITY[quality]) quality = 'ultra';

  status('Starting physics');
  const physics = await createPhysics();
  status('Lighting the sky');
  const lighting = await createLighting({ renderer, scene, camera, assets });
  const pipeline = new Pipeline(renderer, scene, camera);
  status('Shaping terrain');
  const terrain = await createTerrain({ assets, lighting, physics, scene });
  await nextFrame();
  status('Building the bridge');
  const bridge = await createBridge({ assets, lighting, physics, scene, noise: terrain.noise });
  const ctx = { renderer, scene, camera, assets, lighting, physics, terrain, input, quality, time: { value: 0 }, cull: [] };
  status('Growing trees');
  const trees = await createTrees(ctx);
  await nextFrame();
  status('Scattering plants and rocks');
  const plants = await createPlants(ctx);
  ctx.grass = createGrass(ctx, { density: quality === 'medium' ? 0.55 : 1 });
  status('Placing props');
  ctx.props = await createProps(ctx);
  const skyline = createSkyline(ctx);

  trees.forceMeshes();
  const sun = lighting.buildSunDepth(new THREE.Vector3(0, 0, 0), 190);
  pipeline.setSunShadow(sun.texture, sun.matrix);
  ctx.grass.setShadow(sun.texture, sun.matrix);
  pipeline.fogMat.uniforms.uSunDir.value.copy(lighting.sunDirection);
  pipeline.fogMat.uniforms.uSunColor.value.copy(lighting.sunColor);
  pipeline.sunWorld.copy(lighting.sunDirection);

  status('Loading sound');
  ctx.audio = await createAudio(ctx);
  status('Preparing the car');
  const play = await createGame(ctx);
  status('Filling the river');
  const water = await startWater(ctx, [...WATER_OBSTACLES, ...plants.obstacles]);
  if (water.setSunShadow) water.setSunShadow(sun.texture, sun.matrix);
  pipeline.water = water;
  play.setWater(water);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const q = QUALITY[quality];
    const ratio = Math.min(window.devicePixelRatio || 1, q.ratio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pipeline.settings.scale = q.scale;
    pipeline.setSize(w, h, ratio);
    lighting.resize();
    play.setViewport(pipeline.height);
  }
  window.addEventListener('resize', resize);
  resize();

  let running = false;
  let paused = false;
  let elapsed = 0;
  let frames = 0;
  let fps = 60;
  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    fps += (1 / Math.max(raw, 0.001) - fps) * 0.05;
    renderer.info.reset();
    if (!paused) {
      elapsed += dt;
      ctx.time.value = elapsed;
      if (running) play.update(dt, elapsed);
      else {
        play.rig.update(dt, input, play.player, play.car, water);
        ctx.grass.update(camera.position);
        input.endFrame();
      }
      trees.update(camera.position);
      for (const c of ctx.cull) c.object.visible = (c.x - camera.position.x) ** 2 + (c.z - camera.position.z) ** 2 < c.range * c.range;
      lighting.update();
      pipeline.render(dt, elapsed);
    }
    frames++;
    if (frames === 4) {
      window.__ready = true;
      fillEl.style.width = '100%';
      status('Ready');
      goEl.hidden = false;
      if (params.has('auto')) start();
    }
  }

  function lock() {
    if (!canvas.requestPointerLock) return;
    const result = canvas.requestPointerLock();
    if (result && result.catch) result.catch(() => {});
  }

  function start() {
    if (running) return;
    running = true;
    bootEl.classList.add('out');
    play.hud.show();
    if (ctx.audio) ctx.audio.start();
    if (!params.has('auto')) lock();
  }
  goEl.addEventListener('click', start);

  const qualityEl = document.getElementById('opt-quality');
  const volumeEl = document.getElementById('opt-volume');
  qualityEl.value = quality;
  function setPaused(on) {
    paused = on;
    menuEl.hidden = !on;
    if (on && document.exitPointerLock) document.exitPointerLock();
    if (ctx.audio) ctx.audio.setPaused(on);
    clock.getDelta();
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && running) setPaused(!paused);
  });
  document.addEventListener('pointerlockchange', () => {
    if (running && !document.pointerLockElement && !paused && !params.has('auto')) setPaused(true);
  });
  document.getElementById('menu-resume').addEventListener('click', () => {
    setPaused(false);
    lock();
  });
  qualityEl.addEventListener('change', () => {
    quality = qualityEl.value;
    localStorage.setItem('riverside-quality', quality);
    resize();
  });
  volumeEl.addEventListener('input', () => {
    if (ctx.audio) ctx.audio.setVolume(+volumeEl.value);
  });

  window.__dbg = {
    renderer, scene, camera, pipeline, lighting, terrain, bridge, physics, trees, plants, skyline, water, play, input, ctx,
    get fps() {
      return Math.round(fps);
    },
    look(px, py, pz, tx, ty, tz) {
      running = false;
      camera.position.set(px, py, pz);
      camera.lookAt(tx, ty, tz);
      pipeline.reset = true;
      play.rig.update = () => {};
    },
  };
  requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  window.__error = String(error && error.stack ? error.stack : error);
  status('Failed to start: ' + error.message);
});
