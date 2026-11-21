// Costa del Gzowo: bootstrap, loading flow, title cinematics, pause and menu states, main loop.
import * as THREE from 'three';
import { GAME, LAYERS, MUSIC, TOWN, WATER_OBSTACLES } from './config.js';
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
import { createTown } from './world/town/town.js';
import { createFallbackWater } from './world/fallbackWater.js';
import { heightAt, flowAt } from './world/heightfield.js';
import { createGame } from './game.js';
import { createAudio } from './audio/audio.js';
import { createRadio } from './audio/radio.js';
import { createDeck } from './audio/deck.js';
import { createSoundtrack } from './audio/soundtrack.js';
import { createCinematics } from './camera/cinematics.js';
import { createScreens } from './ui/screens.js';
import { AVATARS } from './player/avatars.js';
import { VEHICLES } from './vehicle/vehicles.js';

const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
const QUALITY = { ultra: { ratio: 1.25, scale: 1 }, high: { ratio: 1, scale: 1 }, medium: { ratio: 1, scale: 0.72 } };
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const stored = (key, fallback) => {
  const value = parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
};

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
  let quality = params.get('quality') || localStorage.getItem('costa-quality') || 'ultra';
  if (!QUALITY[quality]) quality = 'ultra';
  let volume = stored('costa-volume', 0.8);
  let musicVolume = stored('costa-music', 0.6);
  let avatar = params.get('avatar') || localStorage.getItem('costa-avatar') || 'default';
  if (!AVATARS.some((a) => a.id === avatar)) avatar = 'default';
  let car = params.get('car') || localStorage.getItem('costa-car') || VEHICLES[0].id;
  if (!VEHICLES.some((v) => v.id === car)) car = VEHICLES[0].id;
  const hooks = {};
  const streamed = params.get('soundtrack') === 'youtube';
  const localMusic = !streamed && (await fetch(MUSIC.title.url, { method: 'HEAD' }).then((r) => r.ok, () => false));
  const deck = localMusic ? null : createDeck();
  const screens = createScreens({
    title: GAME.title,
    cssHref: 'src/ui/screens.css',
    quality,
    volume,
    musicVolume,
    avatars: AVATARS,
    avatar,
    onAvatar: (id) => hooks.avatar && hooks.avatar(id),
    vehicles: VEHICLES,
    vehicle: car,
    onVehicle: (id) => {
      localStorage.setItem('costa-car', id);
      const url = new URL(location.href);
      url.searchParams.delete('car');
      location.replace(url);
    },
    onGesture: () => hooks.gesture && hooks.gesture(),
    onStart: () => hooks.start && hooks.start(),
    onResume: () => hooks.resume && hooks.resume(),
    onResetCar: () => hooks.resetCar && hooks.resetCar(),
    onQuality: (value) => hooks.quality && hooks.quality(value),
    onVolume: (value) => hooks.volume && hooks.volume(value),
    onMusicVolume: (value) => hooks.musicVolume && hooks.musicVolume(value),
    onMenuClose: () => hooks.resume && hooks.resume(),
  });
  let progress = 0;
  let statusText = 'Loading';
  const status = (text) => {
    statusText = text;
    screens.setProgress(progress, statusText);
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.12, 4000);
  camera.layers.enable(LAYERS.DETAIL);
  const assets = new Assets(renderer);
  assets.onProgress = (done, total) => {
    progress = Math.min(0.94, done / Math.max(total, 1));
    screens.setProgress(progress, statusText);
  };
  const input = createInput(canvas);

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
  const ctx = { renderer, scene, camera, assets, lighting, physics, terrain, input, quality, avatar, car, time: { value: 0 }, cull: [] };
  status('Growing trees');
  const trees = await createTrees(ctx);
  await nextFrame();
  status('Scattering plants and rocks');
  const plants = await createPlants(ctx);
  ctx.grass = createGrass(ctx, { density: quality === 'medium' ? 0.55 : 1 });
  status('Placing props');
  ctx.props = await createProps(ctx);
  const skyline = createSkyline(ctx);
  status('Building Gzowo Springs');
  await nextFrame();
  ctx.town = await createTown(ctx);

  trees.forceMeshes();
  const townCorners = [[TOWN.x0, TOWN.z0], [TOWN.x1, TOWN.z0], [TOWN.x0, TOWN.z1], [TOWN.x1, TOWN.z1]].flatMap(([x, z]) => [new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 40, 30, z)]);
  const sun = lighting.buildSunDepth(new THREE.Vector3(0, 0, 0), 190, 4096, townCorners);
  pipeline.setSunShadow(sun.texture, sun.matrix);
  ctx.grass.setShadow(sun.texture, sun.matrix);
  pipeline.fogMat.uniforms.uSunDir.value.copy(lighting.sunDirection);
  pipeline.fogMat.uniforms.uSunColor.value.copy(lighting.sunColor);
  pipeline.sunWorld.copy(lighting.sunDirection);

  status('Loading sound');
  ctx.audio = await createAudio(ctx);
  ctx.audio.setVolume(volume);
  ctx.audio.setMusicVolume(musicVolume);
  status('Preparing the car');
  const play = await createGame(ctx);
  status('Filling the river');
  const water = await startWater(ctx, [...WATER_OBSTACLES, ...plants.obstacles]);
  if (water.setSunShadow) water.setSunShadow(sun.texture, sun.matrix);
  pipeline.water = water;
  play.setWater(water);
  ctx.radio = await createRadio({ audio: ctx.audio, deck, folders: localMusic ? ['assets/music/', 'assets/music-public/'] : ['assets/music-public/'] });
  const soundtrack = createSoundtrack({ audio: ctx.audio, deck, local: localMusic, onTrack: (track) => screens.setTrack(track) });
  const cinematics = createCinematics({ camera, pipeline, lighting });
  play.game.cinematic = true;
  play.character.group.visible = false;

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

  let mode = 'title';
  let paused = false;
  let elapsed = 0;
  let frames = 0;
  let fps = 60;
  let fade = null;
  const clock = new THREE.Clock();

  function lock() {
    if (params.has('auto') || !canvas.requestPointerLock) return;
    const result = canvas.requestPointerLock();
    if (result && result.catch) result.catch(() => {});
  }

  function mapState() {
    const p = play.player.state;
    const onFoot = play.game.mode === 'foot';
    const carYaw = Math.atan2(play.car.forward.x, play.car.forward.z);
    const car = { x: play.car.position.x, z: play.car.position.z, yaw: carYaw };
    return { player: onFoot ? { x: p.position.x, z: p.position.z, yaw: p.yaw } : { ...car }, car };
  }

  function setPaused(on) {
    if (paused === on) return;
    paused = on;
    if (on && document.exitPointerLock) document.exitPointerLock();
    ctx.audio.setPaused(on);
    ctx.radio.pause(on);
    if (on) soundtrack.play('menu', 0.5, 0.8);
    else soundtrack.fade(0, 1);
    clock.getDelta();
  }

  hooks.gesture = () => {
    ctx.audio.start();
    soundtrack.play('title', 1, 1.5);
  };
  hooks.start = () => {
    if (mode !== 'title') return;
    mode = 'starting';
    fade = { t: 0, switched: false };
    ctx.audio.start();
    soundtrack.fade(0, 4);
  };
  hooks.resume = () => {
    setPaused(false);
    lock();
  };
  hooks.resetCar = () => {
    if (play.car.state.submersion > 0.3 || play.car.position.y < -1) play.car.respawn();
    else play.car.reset();
    screens.hidePause();
    hooks.resume();
  };
  hooks.quality = (value) => {
    if (!QUALITY[value]) return;
    quality = value;
    localStorage.setItem('costa-quality', quality);
    resize();
    pipeline.reset = true;
  };
  hooks.avatar = (id) => {
    avatar = id;
    localStorage.setItem('costa-avatar', id);
    play.avatars.set(id).catch((error) => console.warn('Avatar unavailable.', error));
  };
  hooks.volume = (value) => {
    volume = value;
    localStorage.setItem('costa-volume', String(value));
    ctx.audio.setVolume(value);
  };
  hooks.musicVolume = (value) => {
    musicVolume = value;
    localStorage.setItem('costa-music', String(value));
    ctx.audio.setMusicVolume(value);
  };

  window.addEventListener('keydown', (e) => {
    if (mode !== 'playing' || paused || e.defaultPrevented) return;
    if (e.code === 'Escape') {
      setPaused(true);
      screens.showPause();
    } else if (e.code === 'KeyM' || e.code === 'Tab') {
      e.preventDefault();
      setPaused(true);
      screens.setMap(mapState());
      screens.openMenu('map');
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (mode === 'playing' && !document.pointerLockElement && !paused && !params.has('auto')) {
      setPaused(true);
      screens.showPause();
    }
  });

  function updateFade(dt) {
    if (!fade) return;
    fade.t += dt;
    if (!fade.switched) {
      pipeline.fade = Math.max(0, 1 - fade.t / 0.45);
      if (fade.t >= 0.45) {
        fade.switched = true;
        fade.t = 0;
        mode = 'playing';
        cinematics.stop();
        play.game.cinematic = false;
        play.character.group.visible = true;
        play.hud.show();
        lock();
      }
    } else {
      pipeline.fade = Math.min(1, fade.t / 0.8);
      if (fade.t >= 0.8) fade = null;
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    fps += (1 / Math.max(raw, 0.001) - fps) * 0.05;
    ctx.audio.tickMusic(Math.min(raw, 0.1));
    if (deck) deck.tick(Math.min(raw, 0.1), musicVolume);
    renderer.info.reset();
    if (!paused) {
      elapsed += dt;
      ctx.time.value = elapsed;
      updateFade(dt);
      play.update(dt, elapsed);
      if (play.game.cinematic) {
        cinematics.update(dt);
        ctx.grass.update(camera.position);
      }
      trees.update(camera.position);
      ctx.town.update(dt, elapsed, camera);
      for (const c of ctx.cull) c.object.visible = (c.x - camera.position.x) ** 2 + (c.z - camera.position.z) ** 2 < c.range * c.range;
      lighting.update();
      pipeline.render(dt, elapsed);
    }
    frames++;
    if (frames === 4) {
      window.__ready = true;
      screens.setProgress(1, 'Ready');
      screens.ready();
      if (params.has('auto')) {
        const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        press();
        setTimeout(() => {
          if (document.activeElement && document.activeElement.click) document.activeElement.click();
        }, 150);
      }
    }
  }

  window.__dbg = {
    renderer, scene, camera, pipeline, lighting, terrain, bridge, physics, trees, plants, skyline, water, play, input, ctx, screens, cinematics, deck, soundtrack, town: ctx.town,
    get fps() {
      return Math.round(fps);
    },
    get mode() {
      return mode;
    },
    look(px, py, pz, tx, ty, tz) {
      play.game.cinematic = true;
      cinematics.update = () => {};
      camera.position.set(px, py, pz);
      camera.lookAt(tx, ty, tz);
      pipeline.reset = true;
    },
  };
  requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  window.__error = String(error && error.stack ? error.stack : error);
});
