// Costa del Gzowo water: GPU FFT wind-ripple spectrum (fine + coarse tiled layers) baked each frame into mipmapped slope/slope-variance maps.
import * as THREE from 'three';
import { FullscreenPass, passMaterial, makeTarget } from '../gpu.js';

const GRAVITY = 9.81;
const TENSION = 7.4e-5;
const REPEAT = 240;

const SPECTRUM_FRAG = `
uniform sampler2D uH0a;
uniform sampler2D uH0b;
uniform float uN;
uniform vec2 uL;
uniform float uTime;
uniform float uOmega0;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 evolve(sampler2D h0tex, ivec2 c, vec2 k) {
  float kl = length(k);
  float w = sqrt(9.81 * kl + 7.4e-5 * kl * kl * kl);
  w = floor(w / uOmega0) * uOmega0;
  vec4 h0 = texelFetch(h0tex, c, 0);
  vec2 e = vec2(cos(w * uTime), sin(w * uTime));
  vec2 h = cmul(h0.xy, vec2(e.x, -e.y)) + cmul(h0.zw, e);
  vec2 ikxh = vec2(-k.x * h.y, k.x * h.x);
  return ikxh - k.y * h;
}
void main() {
  vec2 coord = floor(gl_FragCoord.xy);
  ivec2 c = ivec2(coord);
  vec2 n = vec2(coord.x < uN * 0.5 ? coord.x : coord.x - uN, coord.y < uN * 0.5 ? coord.y : coord.y - uN);
  vec2 ka = 6.283185307 * n / uL.x;
  vec2 kb = 6.283185307 * n / uL.y;
  gl_FragColor = vec4(evolve(uH0a, c, ka), evolve(uH0b, c, kb));
}
`;

const FFT_FRAG = `
uniform sampler2D uInput;
uniform float uN;
uniform float uSub;
uniform float uHorizontal;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  vec2 fc = floor(gl_FragCoord.xy);
  float index = uHorizontal > 0.5 ? fc.x : fc.y;
  float evenIndex = floor(index / uSub) * (uSub * 0.5) + mod(index, uSub * 0.5);
  ivec2 ce = uHorizontal > 0.5 ? ivec2(int(evenIndex), int(fc.y)) : ivec2(int(fc.x), int(evenIndex));
  ivec2 co = uHorizontal > 0.5 ? ivec2(int(evenIndex + uN * 0.5), int(fc.y)) : ivec2(int(fc.x), int(evenIndex + uN * 0.5));
  vec4 even = texelFetch(uInput, ce, 0);
  vec4 odd = texelFetch(uInput, co, 0);
  float arg = 6.283185307179586 * index / uSub;
  vec2 tw = vec2(cos(arg), sin(arg));
  gl_FragColor = vec4(even.xy + cmul(tw, odd.xy), even.zw + cmul(tw, odd.zw));
}
`;

const ASSEMBLE_FRAG = `
uniform sampler2D uInput;
uniform float uLayer;
void main() {
  vec4 v = texelFetch(uInput, ivec2(gl_FragCoord.xy), 0);
  vec2 s = uLayer > 0.5 ? v.zw : v.xy;
  gl_FragColor = vec4(s, s * s);
}
`;

function gaussianPair(rand) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WaveSpectrum {
  constructor(renderer, { size = 256, fineTile = 6.1, coarseTile = 37.3, windDir = new THREE.Vector2(0.83, 0.55), windSpeed = 4.5, fineSlope = 0.05, coarseSlope = 0.03, split = 6.0, seed = 1337 } = {}) {
    this.renderer = renderer;
    this.N = size;
    this.tiles = [fineTile, coarseTile];
    this.windDir = windDir.clone().normalize();
    this.windSpeed = windSpeed;
    this.targetSlopes = [fineSlope, coarseSlope];
    this.split = split;
    this.seed = seed;
  }

  init() {
    const N = this.N;
    const h0a = this.buildSpectrum(0);
    const h0b = this.buildSpectrum(1);
    this.h0Textures = [h0a, h0b];
    const floatOpts = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.ping = makeTarget(N, N, floatOpts);
    this.pong = makeTarget(N, N, floatOpts);
    const anisotropy = Math.min(2, this.renderer.capabilities.getMaxAnisotropy());
    const slopeOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrap: THREE.RepeatWrapping, mipmaps: true, anisotropy };
    this.slopeTargets = [makeTarget(N, N, slopeOpts), makeTarget(N, N, slopeOpts)];
    this.spectrumPass = new FullscreenPass(passMaterial(SPECTRUM_FRAG, {
      uH0a: { value: h0a },
      uH0b: { value: h0b },
      uN: { value: N },
      uL: { value: new THREE.Vector2(this.tiles[0], this.tiles[1]) },
      uTime: { value: 0 },
      uOmega0: { value: (2 * Math.PI) / REPEAT },
    }));
    this.fftPass = new FullscreenPass(passMaterial(FFT_FRAG, {
      uInput: { value: null },
      uN: { value: N },
      uSub: { value: 2 },
      uHorizontal: { value: 1 },
    }));
    this.assemblePass = new FullscreenPass(passMaterial(ASSEMBLE_FRAG, {
      uInput: { value: null },
      uLayer: { value: 0 },
    }));
    this.slopeTextures = this.slopeTargets.map((t) => t.texture);
  }

  buildSpectrum(layer) {
    const N = this.N;
    const L = this.tiles[layer];
    const rand = mulberry(this.seed + layer * 7919);
    const amp = new Float32Array(N * N * 2);
    const Lw = (this.windSpeed * this.windSpeed) / GRAVITY;
    const wx = this.windDir.x;
    const wz = this.windDir.y;
    const kSplit = this.split;
    let slopeVar = 0;
    const kOf = (i) => (2 * Math.PI * (i < N / 2 ? i : i - N)) / L;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const kx = kOf(i);
        const kz = kOf(j);
        const k = Math.hypot(kx, kz);
        const idx = (j * N + i) * 2;
        if (k < 1e-6) {
          amp[idx] = 0;
          amp[idx + 1] = 0;
          continue;
        }
        const c = (kx * wx + kz * wz) / k;
        const spread = 0.18 + 0.82 * c * c * (c > 0 ? 1 : 0.35);
        let p = (Math.exp(-1 / ((k * Lw) * (k * Lw))) / (k * k * k * k)) * spread;
        const t = Math.min(1, Math.max(0, (k - kSplit * 0.7) / (kSplit * 0.6)));
        const band = t * t * (3 - 2 * t);
        p *= layer === 0 ? band : 1 - band;
        p *= Math.exp(-(k * k) / (220 * 220));
        const [gr, gi] = gaussianPair(rand);
        const s = Math.sqrt(p * 0.5);
        amp[idx] = gr * s;
        amp[idx + 1] = gi * s;
      }
    }
    const data = new Float32Array(N * N * 4);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = (j * N + i) * 2;
        const mi = (N - i) % N;
        const mj = (N - j) % N;
        const midx = (mj * N + mi) * 2;
        const o = (j * N + i) * 4;
        data[o] = amp[idx];
        data[o + 1] = amp[idx + 1];
        data[o + 2] = amp[midx];
        data[o + 3] = -amp[midx + 1];
        const kx = kOf(i);
        const kz = kOf(j);
        const k2 = kx * kx + kz * kz;
        slopeVar += k2 * (amp[idx] * amp[idx] + amp[idx + 1] * amp[idx + 1] + amp[midx] * amp[midx] + amp[midx + 1] * amp[midx + 1]);
      }
    }
    const scale = this.targetSlopes[layer] / Math.sqrt(Math.max(1e-12, slopeVar * 0.5));
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  update(time) {
    const renderer = this.renderer;
    const N = this.N;
    this.spectrumPass.material.uniforms.uTime.value = time % REPEAT;
    this.spectrumPass.render(renderer, this.ping);
    let src = this.ping;
    let dst = this.pong;
    const u = this.fftPass.material.uniforms;
    for (let dir = 1; dir >= 0; dir--) {
      u.uHorizontal.value = dir;
      for (let sub = 2; sub <= N; sub *= 2) {
        u.uSub.value = sub;
        u.uInput.value = src.texture;
        this.fftPass.render(renderer, dst);
        const t = src;
        src = dst;
        dst = t;
      }
    }
    const a = this.assemblePass.material.uniforms;
    a.uInput.value = src.texture;
    for (let layer = 0; layer < 2; layer++) {
      a.uLayer.value = layer;
      this.assemblePass.render(renderer, this.slopeTargets[layer]);
    }
  }

  dispose() {
    this.h0Textures.forEach((t) => t.dispose());
    this.ping.dispose();
    this.pong.dispose();
    this.slopeTargets.forEach((t) => t.dispose());
    this.spectrumPass.dispose();
    this.fftPass.dispose();
    this.assemblePass.dispose();
  }
}
