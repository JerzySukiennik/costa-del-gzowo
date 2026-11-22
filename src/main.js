// Costa del Gzowo: bootstrap, loading flow, quality levels applied live, title cinematics, pause and menu states, main loop.
import * as THREE from 'three';
import { GAME, LAYERS, MUSIC, SPAWN, TOWN, WATER_OBSTACLES } from './config.js';
import { Assets } from './core/assets.js';
import { createPhysics } from './core/physics.js';
import { createInput } from './core/input.js';
import { Pipeline } from './render/pipeline.js';
import { createLighting } from './render/lighting.js';
import { QUALITY, createPerf, renderScale } from './render/quality.js';
import { createMeshLod } from './render/meshLod.js';
import { createModelCull } from './render/modelCull.js';
import { createWaterWatch } from './render/waterWatch.js';
import { createTerrain } from './world/terrain.js';
import { createBridge } from './world/bridge.js';
import { createTrees } from './world/trees.js';
import { createPlants } from './world/plants.js';
import { createGrass } from './world/grass.js';
import { createProps } from './world/props.js';
import { createTown } from './world/town/town.js';
import { createFallbackWater } from './world/fallbackWater.js';
import { heightAt, flowAt } from './world/heightfield.js';
import { createGame } from './game.js';
import { createNameTags } from './ui/nametags.js';
import { createLook } from './render/look.js';
import { createLookEditor } from './ui/lookEditor.js';
import { createPerfPanel } from './ui/perfPanel.js';
import { createPhotoMode } from './ui/photoMode.js';
import { createAudio } from './audio/audio.js';
import { createRadio } from './audio/radio.js';
import { createSoundtrack } from './audio/soundtrack.js';
import { createCinematics } from './camera/cinematics.js';
import { createScreens } from './ui/screens.js';
import { AVATARS } from './player/avatars.js';
import { VEHICLES } from './vehicle/vehicles.js';
import { createNpcs } from './npc/npcs.js';

const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
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
      heightAt, flowAt, obstacles, quality: QUALITY[ctx.quality].water,
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
  let timeMode = params.get('time') || localStorage.getItem('costa-time') || 'cycle';
  if (!['cycle', 'golden', 'night'].includes(timeMode)) timeMode = 'cycle';
  let volume = stored('costa-volume', 0.8);
  let musicVolume = stored('costa-music', 0.6);
  let avatar = params.get('avatar') || localStorage.getItem('costa-avatar') || 'default';
  if (!AVATARS.some((a) => a.id === avatar)) avatar = 'default';
  let car = params.get('car') || localStorage.getItem('costa-car') || VEHICLES[0].id;
  if (!VEHICLES.some((v) => v.id === car)) car = VEHICLES[0].id;
  const hooks = {};
  const lookTools = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  let name = (params.get('name') || localStorage.getItem('costa-name') || '').trim().slice(0, 16);
  if (!name) {
    name = `Player ${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem('costa-name', name);
  }
  const localMusic = params.get('soundtrack') !== 'public' && (await fetch(MUSIC.title.url, { method: 'HEAD' }).then((r) => r.ok, () => false));
  const screens = createScreens({
    title: GAME.title,
    cssHref: 'src/ui/screens.css',
    quality,
    volume,
    musicVolume,
    avatars: AVATARS,
    avatar,
    onAvatar: (id) => hooks.avatar && hooks.avatar(id),
    name,
    onName: (value) => hooks.name && hooks.name(value),
    lookTools,
    onLook: () => hooks.look && hooks.look(),
    onPerf: () => hooks.perf && hooks.perf(),
    vehicles: VEHICLES,
    vehicle: car,
    onVehicle: (id) => hooks.vehicle && hooks.vehicle(id),
    onGesture: () => hooks.gesture && hooks.gesture(),
    onStart: () => hooks.start && hooks.start(),
    onResume: () => hooks.resume && hooks.resume(),
    onResetCar: () => hooks.resetCar && hooks.resetCar(),
    onQuality: (value) => hooks.quality && hooks.quality(value),
    time: timeMode,
    onTime: (value) => {
      timeMode = value;
      localStorage.setItem('costa-time', value);
    },
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
  const perf = createPerf(params);
  const ctx = { renderer, scene, camera, assets, lighting, physics, terrain, input, quality, avatar, car, time: { value: 0 }, cull: [], perf };
  status('Growing trees');
  const trees = await createTrees(ctx, { impostor: QUALITY[quality].impostor, range: QUALITY[quality].treeRange, forest: QUALITY[quality].forest });
  ctx.trees = trees;
  await nextFrame();
  status('Scattering plants and rocks');
  const plants = await createPlants(ctx);
  ctx.grass = createGrass(ctx, { density: QUALITY[quality].grass, reach: QUALITY[quality].grassReach });
  status('Placing props');
  ctx.props = await createProps(ctx);
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
  ctx.onAvatar = (id) => hooks.avatar && hooks.avatar(id, true);
  const play = await createGame(ctx);
  const lod = createMeshLod({ camera, perf });
  ctx.lod = lod;
  lod.watch(play.character.group);
  for (const item of play.fleet) lod.watch(item.model.group);
  if (play.statues) for (const item of play.statues.items) lod.watch(item.rig.group);
  const modelCull = createModelCull({ camera, perf });
  for (const item of play.fleet) modelCull.watch(item.model.group, item.id === 'heli' ? 9 : 6);
  if (play.statues) for (const item of play.statues.items) modelCull.watch(item.rig.group, 1.8, 1);
  lighting.setStage((name, on, light) => {
    const cascade = lighting.csm.lights.indexOf(light);
    modelCull.stage(name, on);
    lod.stage(name, on, cascade);
    if (perf.shadows) trees.stage(name, on, light, cascade);
  });
  pipeline.stage = (name, on) => {
    modelCull.stage(name, on);
    lod.stage(name, on);
    if (perf.reflection) trees.stage(name, on);
  };
  ctx.npc = await createNpcs(ctx, play).catch((error) => {
    console.warn('Pedestrians and traffic unavailable.', error);
    return null;
  });
  const look = createLook(null, lookTools);
  const useLook = (values) => {
    pipeline.look = values;
    play.rig.setLook(values);
  };
  useLook(look.values);
  let lookOpen = false;
  const lookEditor = lookTools ? createLookEditor(look, {
    onClose: () => showLook(false),
    onCompare: (on) => useLook(on ? look.preview('original') : look.values),
  }) : null;
  let perfPanel = null;
  let perfOpen = false;
  function showTool(on) {
    if (on && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    if (!on && !params.has('auto') && canvas.requestPointerLock) {
      const result = canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    }
  }
  function showLook(on) {
    if (!lookEditor) return;
    if (on && perfOpen) showPerf(false);
    lookOpen = on;
    lookEditor.show(on);
    showTool(on);
  }
  function showPerf(on) {
    if (!perfPanel || (perfPanel.running && !on)) return;
    if (on && lookOpen) showLook(false);
    perfOpen = on;
    perfPanel.show(on);
    showTool(on);
  }
  hooks.look = () => {
    if (hooks.resume) hooks.resume();
    setTimeout(() => showLook(true), 400);
  };
  hooks.perf = () => {
    if (hooks.resume) hooks.resume();
    setTimeout(() => showPerf(true), 400);
  };
  status('Filling the river');
  const water = await startWater(ctx, [...WATER_OBSTACLES, ...plants.obstacles]);
  if (water.setSunShadow) water.setSunShadow(sun.texture, sun.matrix);
  pipeline.water = water;
  play.setWater(water);
  const waterWatch = water.surface && water.surface.mesh ? createWaterWatch(renderer, [water.surface.mesh, water.surface.underMesh], camera) : null;
  pipeline.reflectionGate = () => !perf.reflection || !waterWatch || waterWatch.visible;
  ctx.radio = await createRadio({ audio: ctx.audio, folders: localMusic ? ['assets/music/', 'assets/music-public/'] : ['assets/music-public/'] });
  if (!params.has('solo')) {
    const tags = createNameTags();
    const onPlayers = (list) => {
      const others = list.filter((p) => !p.me);
      screens.setPlayers(list);
      play.hud.net('Online', others.length ? others.map((p) => p.name).join(', ') : 'Nobody else here yet');
    };
    import('./net/multiplayer.js')
      .then(({ createMultiplayer }) => createMultiplayer(ctx, play, { name, car, avatar }, { tags, onPlayers }))
      .then((net) => {
        const p = play.player.state.position;
        if (net.slot > 0 && play.game.mode === 'foot' && Math.hypot(p.x - SPAWN.player.x, p.z - SPAWN.player.z) < 2) {
          const x = SPAWN.player.x - net.slot * 1.3;
          play.player.teleport(x, heightAt(x, SPAWN.player.z), SPAWN.player.z, SPAWN.player.yaw);
        }
        ctx.net = net;
        onPlayers(net.players());
        window.addEventListener('pagehide', () => net.leave());
      })
      .catch((error) => console.warn('Multiplayer unavailable, playing alone.', error));
  }
  hooks.vehicle = (id) => {
    const item = play.fleet.find((f) => f.id === id && f.driver < 0 && !f.car.state.occupied);
    if (!item || play.game.mode !== 'foot' || play.game.transition) return;
    const spot = item.model.group.localToWorld(item.entry.doorLocal.clone());
    play.player.teleport(spot.x, heightAt(spot.x, spot.z), spot.z, play.player.state.yaw);
    if (hooks.resume) hooks.resume();
  };
  hooks.name = (value) => {
    name = value;
    localStorage.setItem('costa-name', value);
    if (ctx.net) ctx.net.setProfile({ name: value });
  };
  const soundtrack = createSoundtrack({ audio: ctx.audio, local: localMusic, onTrack: (track) => screens.setTrack(track) });
  const cinematics = createCinematics({ camera, pipeline, lighting });
  play.game.cinematic = true;
  play.character.group.visible = false;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { ratio, scale } = renderScale(QUALITY[quality], window.devicePixelRatio || 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pipeline.settings.scale = scale;
    pipeline.setSize(w, h, ratio);
    lighting.resize();
    play.setViewport(pipeline.height);
    trees.setViewport(pipeline.height);
    lod.setViewport(pipeline.height);
  }
  function applyQuality() {
    const q = QUALITY[quality];
    ctx.quality = quality;
    ctx.cullScale = q.plantRange;
    lighting.setShadows({ size: q.shadowMap, every: q.farShadowEvery, far: q.shadowFar });
    trees.setQuality({ impostor: q.impostor, range: q.treeRange, forest: q.forest });
    ctx.grass.setDetail(q.grass, q.grassReach);
    pipeline.setSamples({ ao: q.ao, fog: q.fog, blur: q.blur });
    if (ctx.npc) ctx.npc.setQuality(quality);
    if (water.params && water.params.reflectionScale !== undefined) {
      water.params.reflectionScale = q.reflection[0];
      water.params.reflectionInterval = q.reflection[1];
    }
    resize();
    pipeline.reset = true;
  }
  window.addEventListener('resize', resize);
  applyQuality();

  let mode = 'title';
  let paused = false;
  let benching = false;
  let held = false;
  let photo = null;
  let capturing = false;
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
    if (play.damage.state.exploded || play.car.state.submersion > 0.3 || play.car.position.y < -1) {
      play.car.respawn();
      if (play.damage.repair) play.damage.repair();
    } else play.car.reset();
    screens.hidePause();
    hooks.resume();
  };
  hooks.quality = (value) => {
    if (!QUALITY[value] || value === quality) return;
    quality = value;
    localStorage.setItem('costa-quality', quality);
    applyQuality();
  };
  hooks.avatar = (id, applied = false) => {
    avatar = id;
    localStorage.setItem('costa-avatar', id);
    if (!applied) play.avatars.set(id).catch((error) => console.warn('Avatar unavailable.', error));
    if (ctx.net) ctx.net.setProfile({ avatar: id });
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
    if (photo && photo.active) {
      if (e.code === 'KeyP') setPhoto(false);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') photo.take();
      return;
    }
    if (e.code === 'KeyP' && photo && !play.game.cinematic) {
      setPhoto(true);
      return;
    }
    if (e.code === 'Escape') {
      setPaused(true);
      screens.showPause();
    } else if (e.code === 'KeyO' && lookEditor) {
      showLook(!lookOpen);
    } else if (e.code === 'KeyI' && perfPanel) {
      showPerf(!perfOpen);
    } else if (perfOpen && perfPanel.key(e.code)) {
      e.preventDefault();
    } else if (e.code === 'KeyM' || e.code === 'Tab') {
      e.preventDefault();
      setPaused(true);
      screens.setMap(mapState());
      screens.openMenu('map');
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (lookOpen && document.pointerLockElement) {
      lookOpen = false;
      lookEditor.show(false);
      return;
    }
    if (perfOpen && document.pointerLockElement && !perfPanel.running) {
      perfOpen = false;
      perfPanel.show(false);
      return;
    }
    if (mode === 'playing' && !document.pointerLockElement && !paused && !lookOpen && !perfOpen && !(photo && photo.active) && !params.has('auto')) {
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

  const DAY_LENGTH = 18 * 60;
  let nightOverride = null;
  function nightNow() {
    if (nightOverride !== null) return nightOverride;
    if (photo && photo.active) return photo.state.time;
    if (timeMode === 'golden') return 0;
    if (timeMode === 'night') return 1;
    const t = ((Date.now() / 1000) % DAY_LENGTH) / DAY_LENGTH;
    if (t < 0.5) return 0;
    if (t < 0.62) return (t - 0.5) / 0.12;
    if (t < 0.88) return 1;
    return 1 - (t - 0.88) / 0.12;
  }

  function renderFrame(dt) {
    renderer.info.reset();
    ctx.time.value = elapsed;
    lighting.setNight(nightNow());
    pipeline.night = lighting.night;
    pipeline.fogMat.uniforms.uSunColor.value.copy(lighting.sunColor);
    pipeline.fogMat.uniforms.uSkyColor.value.copy(lighting.fogSky);
    if (water.params && water.params.causticStrength !== undefined) water.params.causticStrength = 1 - 0.9 * lighting.night;
    if (photo && photo.active) ctx.grass.update(camera.position);
    else {
      updateFade(dt);
      play.update(dt, elapsed);
      if (ctx.npc) ctx.npc.update(dt, elapsed);
      if (play.game.cinematic) {
        if (!held) cinematics.update(dt);
        ctx.grass.update(camera.position);
      }
    }
    camera.updateMatrixWorld();
    trees.lightShadows = perf.shadows;
    trees.update(camera);
    modelCull.update();
    ctx.town.update(dt, elapsed, camera);
    const reach = ctx.cullScale || 1;
    for (const c of ctx.cull) c.object.visible = (c.x - camera.position.x) ** 2 + (c.z - camera.position.z) ** 2 < (c.range * reach) ** 2;
    ctx.grass.culling = perf.grass;
    ctx.grass.cull(camera);
    lod.update();
    if (waterWatch) waterWatch.tick();
    lighting.update();
    if (look.values.dof > 0 && !(photo && photo.active)) {
      const subject = play.game.cinematic ? null : play.game.mode === 'foot' ? play.player.state.position : play.car.position;
      const want = subject ? Math.max(2, camera.position.distanceTo(subject)) : 14;
      pipeline.focus += (want - pipeline.focus) * Math.min(1, dt * 5);
    }
    pipeline.render(dt, elapsed);
    lod.end();
  }

  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    if (!benching) fps += (1 / Math.max(raw, 0.001) - fps) * 0.05;
    ctx.audio.tickMusic(Math.min(raw, 0.1));
    if (!paused && !benching && !capturing) {
      if (photo && photo.active) {
        photo.update(Math.min(raw, 0.05));
        renderFrame(0);
      } else {
        elapsed += dt;
        renderFrame(dt);
      }
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

  async function capturePhoto({ width, height, fov, detail, onProgress }) {
    const kept = quality;
    capturing = true;
    try {
      if (detail && quality !== 'cinematic' && quality !== 'extreme') {
        quality = 'cinematic';
        applyQuality();
      }
      camera.fov = fov;
      if (width) {
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        pipeline.settings.scale = 1;
        pipeline.setSize(width, height, 1);
        trees.setViewport(height);
        lod.setViewport(height);
        play.setViewport(height);
      }
      camera.updateProjectionMatrix();
      lighting.resize();
      pipeline.reset = true;
      const count = 40;
      for (let i = 0; i < count; i++) {
        renderFrame(0);
        if (i % 4 === 3) {
          if (onProgress) onProgress((i + 1) / count);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      renderFrame(0);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } finally {
      quality = kept;
      applyQuality();
      capturing = false;
    }
  }
  photo = createPhotoMode({
    camera, input, canvas, heightAt,
    baseLook: () => look.values,
    night: () => lighting.night,
    previewLook: (id) => look.preview(id),
    applyLook: (values) => (pipeline.look = values),
    setFocus: (distance) => (pipeline.focus = distance),
    playerPosition: () => (play.game.mode === 'foot' ? play.player.state.position : play.car.position),
    setPlayerVisible: (on) => (play.character.group.visible = on),
    capture: capturePhoto,
    exit: () => setPhoto(false),
  });
  function setPhoto(on) {
    if (!photo || photo.busy || on === photo.active) return;
    if (on) {
      if (lookOpen) showLook(false);
      if (perfOpen) showPerf(false);
      document.getElementById('hud').hidden = true;
      photo.enter();
      showTool(true);
    } else {
      photo.exit();
      useLook(look.values);
      document.getElementById('hud').hidden = false;
      pipeline.reset = true;
      clock.getDelta();
      showTool(false);
    }
  }

  const gl = renderer.getContext();
  const pixel = new Uint8Array(4);
  const timed = (dt = 1 / 60) => {
    const start = performance.now();
    elapsed += dt;
    renderFrame(dt);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return performance.now() - start;
  };
  const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));
  function lookAt(px, py, pz, tx, ty, tz, fov) {
    play.game.cinematic = true;
    held = true;
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    if (fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    pipeline.reset = true;
  }
  const benchApi = {
    gpu() {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown graphics card';
    },
    size: () => `${pipeline.width} x ${pipeline.height}`,
    begin() {
      benching = true;
    },
    end() {
      benching = false;
      held = false;
      play.game.cinematic = false;
      pipeline.reset = true;
      clock.getDelta();
    },
    async view(v) {
      if (!v.cam) {
        held = false;
        play.game.cinematic = false;
        pipeline.reset = true;
        return;
      }
      const c = v.cam.slice();
      if (v.ground) {
        c[1] = heightAt(c[0], c[2]) + v.ground;
        c[4] = heightAt(c[3], c[5]) + v.ground + 1.5;
      }
      lookAt(...c, v.fov || 60);
    },
    async settle(count) {
      for (let i = 0; i < count; i++) {
        timed();
        await breathe();
      }
    },
    async measure(count, warm) {
      await benchApi.settle(warm);
      const times = [];
      for (let i = 0; i < count; i++) {
        times.push(timed());
        await breathe();
      }
      times.sort((a, b) => a - b);
      const cut = times.slice(2, -2);
      return cut.reduce((a, b) => a + b, 0) / cut.length;
    },
  };
  if (lookTools) {
    perfPanel = createPerfPanel({
      perf,
      bench: benchApi,
      quality: () => quality,
      setQuality(value) {
        hooks.quality(value);
        screens.syncQuality(value);
      },
      stats: () => ({
        fps: Math.round(fps), ms: 1000 / Math.max(fps, 0.01), width: pipeline.width, height: pipeline.height, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls,
        grassShown: ctx.grass.stats.shown, grassTiles: ctx.grass.stats.tiles, treeMeshes: trees.stats.meshes, forest: trees.stats.forest,
        reflection: pipeline.reflectionGate(), lodReady: lod.stats.ready, lodMeshes: lod.stats.meshes, modelsHidden: modelCull.stats.hidden, models: modelCull.stats.models,
      }),
    }, { onClose: () => showPerf(false) });
  }

  window.__dbg = {
    renderer, scene, camera, pipeline, lighting, terrain, bridge, physics, trees, plants, water, play, input, ctx, screens, cinematics, soundtrack, town: ctx.town, perf, lod, waterWatch, npc: ctx.npc,
    step(dt, time) {
      elapsed = time === undefined ? elapsed + dt : time;
      renderFrame(dt);
    },
    get quality() {
      return quality;
    },
    get night() {
      return lighting.night;
    },
    setTime(value) {
      timeMode = value;
    },
    setNight(value) {
      nightOverride = value;
    },
    setQuality(value) {
      hooks.quality(value);
      screens.syncQuality(value);
    },
    get fps() {
      return Math.round(fps);
    },
    get net() {
      return ctx.net || null;
    },
    looks: look,
    showLook,
    showPerf,
    setPhoto,
    get photo() {
      return photo;
    },
    get perfPanel() {
      return perfPanel;
    },
    bench: benchApi,
    get mode() {
      return mode;
    },
    look: lookAt,
  };
  requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  window.__error = String(error && error.stack ? error.stack : error);
});
