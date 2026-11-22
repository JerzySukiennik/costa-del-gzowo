// Costa del Gzowo water: public WaterSystem facade wiring the bake, surface, reflection, wave sim, splash FX and underwater pass.
import * as THREE from 'three';
import { LAYERS, WORLD } from '../config.js';
import { WaterBake } from './WaterBake.js';
import { floatLinearSupported } from './gpu.js';
import { WaveSpectrum } from './surface/WaveSpectrum.js';
import { Caustics } from './surface/Caustics.js';
import { createNoiseTextures } from './surface/NoiseTextures.js';
import { PlanarReflection } from './surface/PlanarReflection.js';
import { WaterSurface } from './surface/WaterSurface.js';
import { ShoreWetEdge } from './surface/ShoreWetEdge.js';
import { RippleSim } from './sim/RippleSim.js';
import { ParticlePool } from './fx/ParticlePool.js';
import { SplashFX } from './fx/SplashFX.js';
import { UnderwaterPass } from './underwater/UnderwaterPass.js';
import { SiltFX } from './underwater/SiltFX.js';

const QUALITY = {
  ultra: { simRes: 640, simSize: 88, fft: 256, reflection: 0.5, reflectionInterval: 2, spray: 6000, bubbles: 3000, silt: 900, segments: 192, caustics: 512, causticGrid: 256, bakeTexel: 0.6, fx: 1 },
  high: { simRes: 512, simSize: 80, fft: 256, reflection: 0.4, reflectionInterval: 2, spray: 3500, bubbles: 1800, silt: 600, segments: 160, caustics: 512, causticGrid: 192, bakeTexel: 0.75, fx: 0.7 },
  medium: { simRes: 384, simSize: 64, fft: 128, reflection: 0.3, reflectionInterval: 3, spray: 1800, bubbles: 900, silt: 350, segments: 128, caustics: 256, causticGrid: 128, bakeTexel: 1.0, fx: 0.45 },
};

const UNDULATION = [
  { angle: 0.35, length: 9.5, amp: 0.011, phase: 0.0 },
  { angle: 1.25, length: 6.1, amp: 0.007, phase: 1.7 },
  { angle: -0.6, length: 14.7, amp: 0.013, phase: 4.1 },
  { angle: 2.45, length: 4.3, amp: 0.004, phase: 2.6 },
];

const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const axisX = new THREE.Vector3();
const axisZ = new THREE.Vector3();

export class WaterSystem {
  constructor({ renderer, scene, camera, sunDirection, sunColor, heightAt, flowAt, obstacles = [], quality = 'ultra' }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sunDirection = sunDirection;
    this.sunColor = sunColor;
    this.heightAt = heightAt;
    this.flowAt = flowAt;
    this.obstacles = obstacles;
    this.qualityName = QUALITY[quality] ? quality : 'ultra';
    this.quality = QUALITY[this.qualityName];
    this.waterLevel = WORLD.waterLevel;
    this.cameraUnderwater = false;
    this.focus = null;
    this.interactors = [];
    this.rings = [];
    this.elapsed = 0;
    this.params = {
      absorption: new THREE.Vector3(0.4, 0.088, 0.105),
      scattering: new THREE.Vector3(0.012, 0.022, 0.019),
      fineSlope: 1.0,
      coarseSlope: 1.0,
      refraction: 2.2,
      foam: 1.0,
      glitter: 1.0,
      boils: 1.0,
      causticStrength: 1.0,
      wetEdge: 1.0,
      shaftStrength: 1.0,
      underwaterClarity: 0.8,
      reflectionScale: this.quality.reflection,
      reflectionInterval: this.quality.reflectionInterval,
      reflectionFar: 900,
      reflectionMinSize: 0.02,
    };
    this.width = 1;
    this.height = 1;
    this.sample = { depth: 0, vx: 0, vz: 0 };
  }

  async init() {
    const q = this.quality;
    const renderer = this.renderer;
    this.bake = new WaterBake({
      heightAt: this.heightAt,
      flowAt: this.flowAt,
      obstacles: this.obstacles,
      waterLevel: this.waterLevel,
      worldHalf: WORLD.half,
      texel: q.bakeTexel,
    });
    this.bake.build();

    this.spectrum = new WaveSpectrum(renderer, { size: q.fft });
    this.spectrum.init();
    this.spectrum.update(0);
    this.noise = createNoiseTextures(renderer);
    this.caustics = new Caustics(renderer, {
      size: q.caustics,
      grid: q.causticGrid,
      tile: this.spectrum.tiles[0],
      slopeTexture: this.spectrum.slopeTextures[0],
      sunDirection: this.sunDirection,
    });
    this.sim = new RippleSim(renderer, {
      resolution: q.simRes,
      size: q.simSize,
      bake: this.bake,
      obstacles: this.obstacles,
      floatLinear: floatLinearSupported(renderer),
    });
    this.sim.init();
    this.reflection = new PlanarReflection({ scale: q.reflection, layer: LAYERS.WORLD, waterLevel: this.waterLevel });

    const waveA = UNDULATION.map((w) => new THREE.Vector4(Math.cos(w.angle), Math.sin(w.angle), (2 * Math.PI) / w.length, w.amp));
    const waveB = UNDULATION.map((w) => new THREE.Vector4(Math.sqrt(9.81 * ((2 * Math.PI) / w.length)), w.phase, 0, 0));
    this.waveA = waveA;
    this.waveB = waveB;
    const dummyDepth = new THREE.DataTexture(new Float32Array([1, 1, 1, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    dummyDepth.needsUpdate = true;
    this.shared = {
      uBakeA: { value: this.bake.textureA },
      uBakeB: { value: this.bake.textureB },
      uBakeRect: { value: this.bake.rect },
      uWaterLevel: { value: this.waterLevel },
      uTime: { value: 0 },
      uWaveA: { value: waveA },
      uWaveB: { value: waveB },
      uSunDir: { value: this.sunDirection },
      uSunColor: { value: this.sunColor },
      uAmbient: { value: new THREE.Color(0.55, 0.72, 1.0) },
      uAbsorb: { value: this.params.absorption },
      uScatter: { value: this.params.scattering },
      uSkyTex: { value: null },
      uHasSky: { value: 0 },
      uSkyIntensity: { value: 1 },
      uSunShadow: { value: dummyDepth },
      uSunShadowMatrix: { value: new THREE.Matrix4() },
      uHasShadow: { value: 0 },
      uShadowBias: { value: 0.0015 },
      uSceneColor: { value: null },
      uSceneDepth: { value: dummyDepth },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uHasScene: { value: 0 },
      uCaustics: { value: this.caustics.texture },
      uCausticTile: { value: this.spectrum.tiles[0] },
      uCausticStrength: { value: 1 },
      uSimState: { value: this.sim.stateTexture },
      uSimAux: { value: this.sim.auxTexture },
      uSimWindow: { value: this.sim.window },
      uSimTexel: { value: 1 / q.simRes },
      uSimEnabled: { value: 1 },
      uFoamTex: { value: this.noise.foamTexture },
      uCameraUnder: { value: 0 },
    };
    this.dummyDepth = dummyDepth;

    this.surface = new WaterSurface({ segments: q.segments, maxRadius: 3600, layer: LAYERS.WATER, shared: this.shared });
    const su = this.surface.uniforms;
    su.uSlope0.value = this.spectrum.slopeTextures[0];
    su.uSlope1.value = this.spectrum.slopeTextures[1];
    su.uTiles.value.set(this.spectrum.tiles[0], this.spectrum.tiles[1]);
    su.uBoilTex.value = this.noise.boilTexture;
    su.uReflection.value = this.reflection.texture;

    this.wetEdge = new ShoreWetEdge(this.surface.geometry, { ...this.shared, uGridOrigin: su.uGridOrigin }, LAYERS.WATER);
    this.wetEdge.mesh.onBeforeRender = this.surface.mesh.onBeforeRender;

    this.spray = new ParticlePool(q.spray, this.shared, LAYERS.WATER, 'WaterSpray');
    this.bubbles = new ParticlePool(q.bubbles, this.shared, LAYERS.WATER, 'WaterBubbles');
    this.silt = new SiltFX(q.silt, this.shared, LAYERS.WATER);
    this.fx = new SplashFX({
      spray: this.spray,
      bubbles: this.bubbles,
      sim: this.sim,
      heightAt: (x, z) => this.getHeightAt(x, z),
      bedDepthAt: (x, z) => this.bake.sample(x, z, this.sample).depth,
      scale: q.fx,
    });
    const flowTmp = { x: 0, y: 0 };
    this.particleEnv = {
      flow: flowTmp,
      flowAt: (x, z, out) => {
        const s = this.bake.sample(x, z, this.sample);
        out.x = s.vx;
        out.y = s.vz;
        return out;
      },
      heightAt: (x, z) => this.getHeightAt(x, z),
      bedAt: (x, z) => this.waterLevel - this.bake.sample(x, z, this.sample).depth,
      onImpact: (x, z, size, speed) => this.fx.onDropletImpact(x, z, size, speed),
      onSheetImpact: (x, z, size, speed) => this.fx.onSheetImpact(x, z, size, speed),
      onSurface: (x, z, size) => this.fx.onBubbleSurface(x, z, size),
    };

    this.underwaterPass = new UnderwaterPass(this.shared);

    this.group = new THREE.Group();
    this.group.name = 'WaterSystem';
    this.group.add(this.wetEdge.mesh, this.surface.mesh, this.bubbles.mesh, this.silt.mesh, this.spray.mesh);
    this.group.traverse((o) => o.layers.set(LAYERS.WATER));
    this.scene.add(this.group);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
    this.refreshSky();
  }

  refreshSky() {
    const bg = this.scene.background;
    const ok = bg && bg.isTexture && bg.mapping === THREE.EquirectangularReflectionMapping;
    this.shared.uSkyTex.value = ok ? bg : null;
    this.shared.uHasSky.value = ok ? 1 : 0;
    this.shared.uSkyIntensity.value = this.scene.backgroundIntensity ?? 1;
    if (ok && this.skyId !== bg.uuid) {
      this.skyId = bg.uuid;
      const amb = estimateSkyAmbient(bg);
      if (amb) {
        this.shared.uAmbient.value.copy(amb).multiplyScalar(this.shared.uSkyIntensity.value);
        this.ambientFromSky = true;
      }
    }
    if (!this.ambientFromSky) {
      const c = this.sunColor;
      this.shared.uAmbient.value.setRGB(c.r * 0.055, c.g * 0.075, c.b * 0.115);
    }
  }

  update(dt, elapsed, camera = this.camera) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.elapsed = elapsed;
    this.camera = camera;
    const sh = this.shared;
    sh.uTime.value = elapsed;
    this.refreshSky();
    sh.uCausticStrength.value = this.params.causticStrength;
    this.wetEdge.uniforms.uWetStrength.value = this.params.wetEdge;
    this.wetEdge.mesh.visible = this.params.wetEdge > 0;
    const su = this.surface.uniforms;
    su.uLayerAmp.value.set(this.params.fineSlope, this.params.coarseSlope);
    su.uRefraction.value = this.params.refraction;
    su.uFoamAmount.value = this.params.foam;
    su.uGlitter.value = this.params.glitter;
    su.uBoilStrength.value = this.params.boils;
    this.underwaterPass.uniforms.uShaftStrength.value = this.params.shaftStrength;
    this.underwaterPass.uniforms.uClarity.value = this.params.underwaterClarity;

    this.frame = (this.frame || 0) + 1;
    if (this.frame % 2 === 0) this.spectrum.update(elapsed);
    else this.caustics.update(1);

    const camPos = tmpVec.setFromMatrixPosition(camera.matrixWorld);
    this.fx.update(dt);
    this.fx.updateInteractors(this.interactors, dt);
    this.spray.update(dt, this.particleEnv);
    this.bubbles.update(dt, this.particleEnv);
    this.spray.upload();
    this.bubbles.upload();

    let cx;
    let cz;
    if (this.focus) {
      cx = this.focus.x;
      cz = this.focus.z;
    } else {
      const fwd = tmpVec2.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(tmpQuat));
      const fl = Math.hypot(fwd.x, fwd.z) || 1;
      const lead = this.sim.size * 0.2 * Math.min(1, fl * 1.5);
      cx = camPos.x + (fwd.x / fl) * lead;
      cz = camPos.z + (fwd.z / fl) * lead;
    }
    this.sim.setCenter(cx, cz);
    this.sim.setInteractors(this.packInteractors());
    this.sim.step(dt);
    sh.uSimState.value = this.sim.stateTexture;
    sh.uSimAux.value = this.sim.auxTexture;

    for (let i = this.rings.length - 1; i >= 0; i--) if (elapsed - this.rings[i].t0 > 12) this.rings.splice(i, 1);

    const surfaceY = this.getHeightAt(camPos.x, camPos.z);
    const depthHere = this.bake.sample(camPos.x, camPos.z, this.sample).depth;
    const wet = depthHere > 0.02;
    this.cameraUnderwater = wet && camPos.y < surfaceY;
    sh.uCameraUnder.value = this.cameraUnderwater ? 1 : 0;
    const near = camera.near ?? 0.1;
    const nearBand = near * 2.5 + 0.12;
    this.underwaterPass.enabled = wet && camPos.y < surfaceY + nearBand;
    const uu = this.underwaterPass.uniforms;
    uu.uFull.value = this.cameraUnderwater && camPos.y < surfaceY - nearBand ? 1 : 0;
    uu.uSimHeightAtCam.value = surfaceY - this.waterLevel - this.undulationAt(camPos.x, camPos.z, depthHere);
    this.surface.follow(camPos);
    this.silt.update(camPos, this.particleEnv.flowAt(camPos.x, camPos.z, { x: 0, y: 0 }), dt, this.cameraUnderwater);
  }

  packInteractors() {
    const out = [];
    for (const it of this.interactors) {
      const vehicle = it.kind === 'vehicle';
      let halfX = it.radius ?? 0.35;
      let halfZ = halfX;
      let c = 1;
      let s = 0;
      if (vehicle && it.halfExtents) {
        const fp = it.footprint;
        halfX = fp.halfAlongX;
        halfZ = fp.halfAlongZ;
        c = fp.cos;
        s = fp.sin;
      }
      out.push({
        x: it.position.x,
        z: it.position.z,
        vx: it.velocity.x,
        vz: it.velocity.z,
        vy: it.velocity.y,
        halfX,
        halfZ,
        cos: c,
        sin: s,
        submersion: Math.min(1, Math.max(0, it.submersion ?? 0.5)),
        foamGain: vehicle ? 1.6 : it.kind === 'character' ? 0.9 : 0.5,
        kind: vehicle ? 1 : 0,
      });
    }
    return out;
  }

  renderReflection(renderer, scene, camera) {
    if (this.cameraUnderwater) return;
    const r = this.reflection;
    r.far = this.params.reflectionFar;
    r.minAngularSize = this.params.reflectionMinSize;
    if (r.scale !== this.params.reflectionScale) {
      r.scale = this.params.reflectionScale;
      r.setSize();
    }
    this.reflectionFrame = (this.reflectionFrame || 0) + 1;
    const interval = Math.max(1, this.params.reflectionInterval | 0);
    if (r.valid && this.reflectionFrame % interval !== 0) return;
    const ok = r.render(renderer, scene, camera);
    this.surface.uniforms.uHasReflection.value = this.reflection.valid ? 1 : 0;
    if (ok) this.surface.uniforms.uReflMatrix.value.copy(this.reflection.matrix);
  }

  setSceneBuffers(colorTexture, depthTexture, width, height) {
    this.shared.uSceneColor.value = colorTexture;
    this.shared.uSceneDepth.value = depthTexture;
    this.shared.uHasScene.value = colorTexture ? 1 : 0;
    if (width && height) this.shared.uResolution.value.set(width, height);
  }

  setSunShadow(depthTexture, worldToShadowMatrix) {
    this.shared.uSunShadow.value = depthTexture ?? this.dummyDepth;
    if (worldToShadowMatrix) this.shared.uSunShadowMatrix.value.copy(worldToShadowMatrix);
    this.shared.uHasShadow.value = depthTexture ? 1 : 0;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.shared.uResolution.value.set(width, height);
    this.reflection.setSize(width, height);
  }

  setFocus(position) {
    this.focus = position ? position.clone() : null;
  }

  splash({ position, velocity, radius = 0.4, mass = 80, kind = 'character' }) {
    let extents = null;
    if (kind === 'vehicle') {
      let best = null;
      let bestD = 6;
      for (const it of this.interactors) {
        if (it.kind !== 'vehicle' || !it.footprint) continue;
        const d = Math.hypot(it.position.x - position.x, it.position.z - position.z);
        if (d < bestD) {
          bestD = d;
          best = it.footprint;
        }
      }
      if (best) {
        extents = { hx: best.halfWidth, hz: best.halfLength, fx: best.fx, fz: best.fz, ax: best.ax, az: best.az };
      } else {
        const h = Math.hypot(velocity.x, velocity.z);
        const fx = h > 0.3 ? velocity.x / h : 0;
        const fz = h > 0.3 ? velocity.z / h : 1;
        const half = Math.min(3, Math.max(1.5, radius * 0.95));
        extents = { hx: half * 0.4, hz: half, fx, fz, ax: fz, az: -fx };
      }
    }
    this.fx.splash({ position, velocity, radius, mass, kind, extents });
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const amp = Math.min(kind === 'vehicle' ? 0.3 : 0.06, 0.00004 * mass * speed + 0.01);
    this.rings.push({ x: position.x, z: position.z, t0: this.elapsed, amp, speed: kind === 'vehicle' ? 3.2 : 1.6 });
    if (this.rings.length > 16) this.rings.shift();
  }

  setInteractors(list) {
    this.interactors = list.map((it) => {
      const out = { ...it };
      if (it.kind === 'vehicle' && it.halfExtents && it.quaternion) {
        const qn = it.quaternion;
        axisX.set(1, 0, 0).applyQuaternion(qn);
        axisZ.set(0, 0, 1).applyQuaternion(qn);
        const lx = Math.hypot(axisX.x, axisX.z) || 1e-3;
        const lz = Math.hypot(axisZ.x, axisZ.z) || 1e-3;
        const hx = it.halfExtents.x * lx;
        const hz = it.halfExtents.z * lz;
        const cos = axisX.x / lx;
        const sin = axisX.z / lx;
        const longZ = hz >= hx;
        out.footprint = {
          halfAlongX: Math.max(0.3, hx),
          halfAlongZ: Math.max(0.3, hz),
          cos,
          sin,
          fx: longZ ? axisZ.x / lz : axisX.x / lx,
          fz: longZ ? axisZ.z / lz : axisX.z / lx,
          ax: longZ ? axisX.x / lx : axisZ.x / lz,
          az: longZ ? axisX.z / lx : axisZ.z / lz,
          halfLength: Math.max(hx, hz),
          halfWidth: Math.min(hx, hz),
        };
      }
      return out;
    });
  }

  addRipple(x, z, radius, strength) {
    this.fx.ripple(x, z, radius, strength);
  }

  undulationAt(x, z, depth) {
    const m = 0.25 * smoothstep(-0.05, 0.25, depth) + 0.75 * smoothstep(0.2, 2.0, depth);
    if (m <= 0) return 0;
    let h = 0;
    const t = this.elapsed;
    for (let i = 0; i < 4; i++) {
      const a = this.waveA[i];
      const b = this.waveB[i];
      h += a.w * Math.sin(a.z * (a.x * x + a.y * z) - b.x * t + b.y);
    }
    return h * m;
  }

  getHeightAt(x, z) {
    const depth = this.bake ? this.bake.sample(x, z, this.sample).depth : 1;
    let h = this.waterLevel + (this.waveA ? this.undulationAt(x, z, depth) : 0);
    for (const r of this.rings) {
      const age = this.elapsed - r.t0;
      const d = Math.hypot(x - r.x, z - r.z);
      const rho = d - r.speed * age;
      h += (r.amp * Math.exp(-age / 2.2) * Math.exp(-(rho * rho) / 2.5) * Math.cos(rho * 1.8)) / (1 + d * 0.25);
    }
    return h;
  }

  getFlowAt(x, z, target = new THREE.Vector2()) {
    if (!this.bake) return target.set(0, 0);
    const s = this.bake.sample(x, z, this.sample);
    return target.set(s.vx, s.vz);
  }

  dispose() {
    this.scene.remove(this.group);
    this.bake.dispose();
    this.spectrum.dispose();
    this.caustics.dispose();
    this.noise.foam.dispose();
    this.noise.boil.dispose();
    this.sim.dispose();
    this.reflection.dispose();
    this.surface.dispose();
    this.wetEdge.dispose();
    this.spray.dispose();
    this.bubbles.dispose();
    this.silt.dispose();
    this.underwaterPass.dispose();
    this.dummyDepth.dispose();
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function estimateSkyAmbient(texture) {
  const img = texture.image;
  if (!img || !img.data || !img.width) return null;
  const { data, width, height } = img;
  const half = data instanceof Uint16Array;
  const channels = data.length / (width * height);
  if (channels < 3) return null;
  const read = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  const flipY = texture.flipY;
  for (let j = 0; j < 48; j++) {
    const v = (j + 0.5) / 48;
    const elev = v * (Math.PI / 2);
    const py = flipY ? Math.floor((0.5 - elev / Math.PI) * height) : Math.floor((0.5 + elev / Math.PI) * height);
    const row = Math.min(height - 1, Math.max(0, py));
    const weight = Math.sin(elev) * Math.cos(elev);
    for (let i = 0; i < 96; i++) {
      const px = Math.floor(((i + 0.5) / 96) * width);
      const k = (row * width + px) * channels;
      r += Math.min(read(k), 12) * weight;
      g += Math.min(read(k + 1), 12) * weight;
      b += Math.min(read(k + 2), 12) * weight;
      w += weight;
    }
  }
  return new THREE.Color(r / w, g / w, b / w);
}
