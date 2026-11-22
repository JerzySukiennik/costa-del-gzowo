// Costa del Gzowo: camera-following instanced lawn, tall meadow grass, shoreline reeds and eelgrass, drawn in tiles that are skipped outside the view; blades bend as arcs in rolling wind gusts and lie down along a persistent trample map that slowly springs back.
import * as THREE from 'three';
import { LAYERS, WORLD } from '../config.js';
import { rng } from './scatter.js';

const BEND_RES = 384;
const BEND_SIZE = 76.8;
const STAMPS = 16;
const TILES = 8;
const BLOCK = 8;

const PARS = `
attribute vec4 aInst;
attribute vec3 aBlade;
uniform sampler2D tHeight;
uniform sampler2D tVeg;
uniform sampler2D tNoise;
uniform sampler2D tBend;
uniform vec3 uCam;
uniform float uTime;
uniform float uSpan;
uniform vec2 uHeights;
uniform float uChannel;
uniform float uWind;
uniform vec2 uWindDir;
uniform vec2 uBendCenter;
uniform vec4 uPushA;
uniform vec4 uPushB;
varying float vT;
varying float vRand;
varying float vLay;
varying float vSeed;
`;
const VERTEX = `
{
  vec2 base = mod(aInst.xy - uCam.xz + uSpan * 0.5, uSpan) + uCam.xz - uSpan * 0.5;
  float world = ${(WORLD.half * 2).toFixed(1)};
  float ground = texture2D(tHeight, (base + world * 0.5 + 0.5) / (world + 1.0)).r;
  vec4 veg = texture2D(tVeg, base / world + 0.5);
  float mask = veg.r;
  if (uChannel > 2.5) mask = veg.r * smoothstep(0.3, 0.52, texture2D(tNoise, base * 0.0047).r) * smoothstep(10.0, 18.0, abs(base.y)) * 1.6;
  else if (uChannel > 1.5) mask = smoothstep(-0.3, -0.7, ground) * smoothstep(-3.4, -2.2, ground) * step(0.5, texture2D(tNoise, base * 0.013).g) * 1.4;
  else if (uChannel > 0.5) mask = veg.g;
  float fade = 1.0 - smoothstep(uSpan * 0.36, uSpan * 0.485, distance(base, uCam.xz));
  float keep = step(aInst.w, mask) * fade;
  float hgt = mix(uHeights.x, uHeights.y, aInst.z) * (0.55 + 0.55 * min(mask, 1.0)) * keep;
  float yaw = aInst.w * 61.3;
  float cy = cos(yaw);
  float sy = sin(yaw);
  vec3 local = position;
  local.xz = mat2(cy, -sy, sy, cy) * local.xz;
  float t = aBlade.x;
  float arc = local.y * hgt;

  vec2 windBend;
  if (uChannel > 1.5 && uChannel < 2.5) {
    windBend = vec2(0.12, 1.0) * (0.55 + 0.25 * sin(uTime * 1.3 + base.x * 0.7 + base.y * 0.4 + aBlade.y * 3.0));
  } else {
    float rolling = texture2D(tNoise, (base - uWindDir * uTime * 6.5) * 0.011).r;
    float ripple = texture2D(tNoise, (base - uWindDir * uTime * 2.8) * 0.07).g;
    float gust = rolling * rolling * 1.3 + ripple * 0.35;
    float pace = 1.5 / sqrt(max(hgt, 0.06));
    float sway = sin(uTime * pace + aInst.z * 40.0 + aBlade.y * 17.0 + dot(base, uWindDir) * 0.9);
    float cross = sin(uTime * pace * 1.7 + aBlade.y * 31.0 + aInst.w * 23.0);
    windBend = uWindDir * (0.1 + 0.8 * gust + sway * (0.06 + 0.12 * gust)) + vec2(-uWindDir.y, uWindDir.x) * cross * (0.03 + 0.06 * gust);
    windBend *= uWind;
  }

  vec2 buv = (base - uBendCenter) / ${BEND_SIZE.toFixed(1)} + 0.5;
  vec4 bend = texture2D(tBend, buv);
  float inside = step(0.0, buv.x) * step(buv.x, 1.0) * step(0.0, buv.y) * step(buv.y, 1.0) * step(uChannel, 1.5 + step(2.5, uChannel) * 2.0);
  float lay = clamp(max(bend.r, bend.g * 0.85 * smoothstep(0.2, 0.5, hgt)), 0.0, 1.0) * inside;
  vec2 layDir = bend.ba * 2.0 - 1.0;
  float turn = (aBlade.y - 0.5) * 1.3 * lay;
  layDir = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * normalize(layDir + vec2(0.0001, 0.0));
  vec2 da = base - uPushA.xz;
  float ka = clamp(1.0 - length(da) / uPushA.w, 0.0, 1.0) * step(abs(ground - uPushA.y), 1.6);
  vec2 db = base - uPushB.xz;
  float kb = clamp(1.0 - length(db) / uPushB.w, 0.0, 1.0) * step(abs(ground - uPushB.y), 1.6);
  vec2 hinge = layDir * lay * (1.38 + 0.12 * aBlade.y) + normalize(da + 0.0001) * ka * ka * 0.95 + normalize(db + 0.0001) * kb * kb * 0.95;
  float hingeAngle = min(length(hinge), 1.5);
  vec2 hingeDir = hinge / max(length(hinge), 0.0001);
  windBend *= 1.0 - 0.85 * clamp(hingeAngle / 1.2, 0.0, 1.0);

  float theta = length(windBend);
  vec2 windAxis = windBend / max(theta, 0.0001);
  float angle = max(theta * t, 0.001);
  float reach = arc * (1.0 - cos(angle)) / angle;
  float rise = arc * sin(angle) / angle;
  vec2 off = local.xz * step(0.001, hgt) + windAxis * reach;
  float fold = hingeAngle * smoothstep(0.0, 0.22, t);
  float along = dot(off, hingeDir);
  float laid = along * cos(fold) + rise * sin(fold);
  rise = max(-along * sin(fold) + rise * cos(fold), (0.02 + 0.03 * aBlade.y) * step(0.001, t) * step(0.001, hgt));
  off += hingeDir * (laid - along);
  transformed = vec3(base.x + off.x, ground - 0.02 + rise, base.y + off.y);
  vT = t;
  vRand = aInst.z;
  vLay = lay;
  vSeed = aBlade.z;
}
`;
const VERT_MAIN = `
varying vec3 vWPos;
varying vec3 vFace;
void main() {
  vec3 transformed = position;
  VERTEX_BODY
  vWPos = transformed;
  vFace = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
}`;
const FRAG = `
uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec3 uDryColor;
uniform vec3 uSeedColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform sampler2D tShadow;
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform mat4 uCarInv;
uniform vec4 uBody;
varying float vT;
varying float vRand;
varying float vLay;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vFace;
float staticShadow(vec3 p) {
  vec4 sc = uShadowMatrix * vec4(p + uSunDir * 0.12, 1.0);
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
  vec2 t = vec2(1.0 / 4096.0);
  float s = step(sc.z - 0.0012, texture2D(tShadow, sc.xy).r);
  s += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(t.x, 0.0)).r);
  s += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(0.0, t.y)).r);
  s += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + t).r);
  return s * 0.25;
}
float carShadow(vec3 p) {
  vec3 o = (uCarInv * vec4(p, 1.0)).xyz;
  vec3 d = mat3(uCarInv) * uSunDir;
  vec3 inv = 1.0 / d;
  vec3 t0 = (vec3(-2.4, 0.14, -0.93) - o) * inv;
  vec3 t1 = (vec3(2.25, 0.98, 0.93) - o) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  float near = max(max(tn.x, tn.y), tn.z);
  float far = min(min(tf.x, tf.y), tf.z);
  return far >= max(near, 0.0) ? 0.0 : 1.0;
}
float bodyShadow(vec3 p) {
  vec3 oc = uBody.xyz + vec3(0.0, 0.9, 0.0) - p;
  float along = dot(oc, uSunDir);
  float d2 = dot(oc, oc) - along * along;
  return along > 0.0 ? smoothstep(0.06, 0.2, d2 / max(uBody.w * uBody.w, 0.0001) * 0.16) : 1.0;
}
void main() {
  vec3 tip = mix(uTipColor, uDryColor, smoothstep(0.5, 0.95, vRand) * 0.85);
  vec3 col = mix(uBaseColor, tip, pow(vT, 0.75));
  col = mix(col, uSeedColor, vSeed * smoothstep(0.74, 0.86, vT));
  col = mix(col, mix(uDryColor, col, 0.45) * 1.12, vLay * 0.55);
  vec3 n = normalize(vec3(vFace.x * 0.35, 1.0, vFace.z * 0.35));
  float shadow = uShadowOn > 0.5 ? staticShadow(vWPos) : 1.0;
  shadow *= carShadow(vWPos) * bodyShadow(vWPos);
  float ndl = clamp(dot(n, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 V = normalize(vWPos - cameraPosition);
  float back = pow(max(dot(V, uSunDir), 0.0), 2.0) * vT;
  float sheen = pow(max(dot(reflect(V, vec3(0.0, 1.0, 0.0)), uSunDir), 0.0), 9.0) * vLay * 0.5;
  vec3 light = uSunColor * 0.3183 * shadow * (ndl + back * (0.7 + vSeed * 0.5) + sheen) + uSkyColor * (0.45 + 0.55 * vT);
  gl_FragColor = vec4(col * light, 1.0);
}`;

const BEND_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const BEND_FRAG = `
uniform sampler2D tPrev;
uniform vec2 uShift;
uniform vec2 uCenter;
uniform vec2 uDecay;
uniform vec4 uA[${STAMPS}];
uniform vec4 uB[${STAMPS}];
uniform vec4 uC[${STAMPS}];
varying vec2 vUv;
void main() {
  vec2 uv = vUv + uShift;
  vec4 v = vec4(0.0, 0.0, 0.5, 0.5);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) v = texture2D(tPrev, uv);
  v.r = max(0.0, v.r - uDecay.x * (0.03 + 0.4 * max(v.r - 0.72, 0.0)));
  v.g = max(0.0, v.g - uDecay.y * 0.2);
  vec2 world = uCenter + (vUv - 0.5) * ${BEND_SIZE.toFixed(1)};
  for (int i = 0; i < ${STAMPS}; i++) {
    vec4 a = uA[i];
    vec4 b = uB[i];
    vec4 c = uC[i];
    if (c.x + c.y <= 0.0) continue;
    vec2 p = world - a.xy;
    vec2 q = vec2(dot(p, b.xy), dot(p, vec2(-b.y, b.x)));
    float corner = min(a.z, a.w);
    float dist = length(max(abs(q) - (a.zw - corner), 0.0)) - corner;
    float cover = 1.0 - smoothstep(-c.z, c.z, dist);
    if (cover <= 0.0) continue;
    vec2 dir = c.w > 0.5 ? normalize(p + vec2(0.0001, 0.0)) : b.zw;
    float press = cover * c.x;
    float body = cover * c.y;
    if (max(press, body) > max(v.r, v.g) * 0.85) v.ba = dir * 0.5 + 0.5;
    v.r = max(v.r, press);
    v.g = max(v.g, body);
  }
  gl_FragColor = v;
}`;

function clumpGeometry(blades, width, segments, spread, seed, seedHeads = 0) {
  const random = rng(seed);
  const pos = [];
  const nor = [];
  const blade = [];
  const idx = [];
  for (let b = 0; b < blades; b++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * spread;
    const ox = Math.cos(a) * r;
    const oz = Math.sin(a) * r;
    const face = random() * Math.PI * 2;
    const fx = Math.cos(face);
    const fz = Math.sin(face);
    const lean = (random() - 0.3) * 0.35;
    const w = width * (0.7 + random() * 0.6);
    const tall = 0.65 + random() * 0.35;
    const id = random();
    const head = random() < seedHeads ? 1 : 0;
    const start = pos.length / 3;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      let half = w * 0.5 * (1 - Math.pow(t, 1.6));
      if (head) half = w * 0.3 * (1 - Math.pow(t, 2.2)) + (t > 0.74 ? w * 0.42 * Math.sin(((t - 0.74) / 0.26) * Math.PI) : 0);
      const cx = ox + fz * lean * t * t;
      const cz = oz - fx * lean * t * t;
      if (s === segments) {
        pos.push(cx, t * tall, cz);
        nor.push(fz, 0, -fx);
        blade.push(t, id, head);
      } else {
        pos.push(cx - fx * half, t * tall, cz - fz * half, cx + fx * half, t * tall, cz + fz * half);
        nor.push(fz, 0, -fx, fz, 0, -fx);
        blade.push(t, id, head, t, id, head);
      }
    }
    for (let s = 0; s < segments - 1; s++) {
      const o = start + s * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    const o = start + (segments - 1) * 2;
    idx.push(o, o + 1, o + 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 3));
  geo.setIndex(idx);
  return geo;
}

function createBendMap(renderer) {
  const make = () => {
    const rt = new THREE.WebGLRenderTarget(BEND_RES, BEND_RES, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    rt.texture.colorSpace = THREE.NoColorSpace;
    rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    return rt;
  };
  const targets = [make(), make()];
  const zero = () => Array.from({ length: STAMPS }, () => new THREE.Vector4());
  const uniforms = { tPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uCenter: { value: new THREE.Vector2() }, uDecay: { value: new THREE.Vector2() }, uA: { value: zero() }, uB: { value: zero() }, uC: { value: zero() } };
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BEND_VERT, fragmentShader: BEND_FRAG, uniforms, depthTest: false, depthWrite: false, toneMapped: false }));
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const texel = BEND_SIZE / BEND_RES;
  const center = new THREE.Vector2(1e9, 1e9);
  const pending = [];
  let index = 0;
  let frame = 0;
  let decay = 0;
  let cleared = false;

  return {
    center,
    get texture() {
      return targets[index].texture;
    },
    press(stamp) {
      if (pending.length < STAMPS) pending.push(stamp);
    },
    update(x, z, dt) {
      const cx = Math.round(x / texel) * texel;
      const cz = Math.round(z / texel) * texel;
      const jump = Math.abs(cx - center.x) > BEND_SIZE || Math.abs(cz - center.y) > BEND_SIZE;
      uniforms.uShift.value.set(jump ? 9 : (cx - center.x) / BEND_SIZE, jump ? 9 : (cz - center.y) / BEND_SIZE);
      center.set(cx, cz);
      uniforms.uCenter.value.copy(center);
      decay += dt;
      frame++;
      if (frame % 6 === 0) {
        uniforms.uDecay.value.set(decay, decay);
        decay = 0;
      } else uniforms.uDecay.value.set(0, 0);
      for (let i = 0; i < STAMPS; i++) {
        const s = pending[i];
        if (!s) {
          uniforms.uC.value[i].set(0, 0, 1, 0);
          continue;
        }
        const length = Math.hypot(s.dirX || 0, s.dirZ || 0);
        const dx = length > 1e-4 ? s.dirX / length : 1;
        const dz = length > 1e-4 ? s.dirZ / length : 0;
        const ax = s.axisX === undefined ? dx : s.axisX;
        const az = s.axisZ === undefined ? dz : s.axisZ;
        uniforms.uA.value[i].set(s.x, s.z, s.length || s.radius, s.radius);
        uniforms.uB.value[i].set(ax, az, dx, dz);
        uniforms.uC.value[i].set(s.press || 0, s.body || 0, s.soft || 0.18, s.radial || length <= 1e-4 ? 1 : 0);
      }
      pending.length = 0;
      const next = 1 - index;
      uniforms.tPrev.value = targets[index].texture;
      const previous = renderer.getRenderTarget();
      const auto = renderer.autoClear;
      renderer.autoClear = true;
      if (!cleared) {
        cleared = true;
        uniforms.uShift.value.set(9, 9);
      }
      renderer.setRenderTarget(targets[next]);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
      renderer.autoClear = auto;
      index = next;
    },
  };
}

function heightBlocks(heights, grid) {
  const n = Math.ceil(grid / BLOCK);
  const lo = new Float32Array(n * n).fill(Infinity);
  const hi = new Float32Array(n * n).fill(-Infinity);
  for (let j = 0; j < grid; j++) {
    const row = Math.floor(j / BLOCK) * n;
    for (let i = 0; i < grid; i++) {
      const h = heights[j * grid + i];
      const k = row + Math.floor(i / BLOCK);
      if (h < lo[k]) lo[k] = h;
      if (h > hi[k]) hi[k] = h;
    }
  }
  return (x0, x1, z0, z1, out) => {
    const clamp = (v) => Math.min(grid - 1, Math.max(0, v));
    const i0 = Math.floor(clamp(Math.floor(x0 + WORLD.half) - 1) / BLOCK);
    const i1 = Math.floor(clamp(Math.ceil(x1 + WORLD.half) + 1) / BLOCK);
    const j0 = Math.floor(clamp(Math.floor(z0 + WORLD.half) - 1) / BLOCK);
    const j1 = Math.floor(clamp(Math.ceil(z1 + WORLD.half) + 1) / BLOCK);
    let a = Infinity;
    let b = -Infinity;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * n + i;
        if (lo[k] < a) a = lo[k];
        if (hi[k] > b) b = hi[k];
      }
    }
    out[0] = a;
    out[1] = b;
  };
}

export function createGrass(ctx, { density = 1, reach = 1 } = {}) {
  const { terrain, lighting, scene, renderer } = ctx;
  const grid = WORLD.half * 2 + 1;
  const heightTex = new THREE.DataTexture(terrain.heights, grid, grid, THREE.RedFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  const heightRange = heightBlocks(terrain.heights, grid);
  const bend = createBendMap(renderer);
  const group = new THREE.Group();
  group.name = 'grass';
  scene.add(group);
  const shared = {
    uCam: { value: new THREE.Vector3() }, uPushA: { value: new THREE.Vector4(0, -100, 0, 1) }, uPushB: { value: new THREE.Vector4(0, -100, 0, 1) },
    tShadow: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uCarInv: { value: new THREE.Matrix4().makeTranslation(0, -1000, 0) }, uBody: { value: new THREE.Vector4(0, -1000, 0, 0.3) },
    tBend: { value: bend.texture }, uBendCenter: { value: bend.center }, uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
  };

  function place(geo, material) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.layers.set(LAYERS.DETAIL);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return mesh;
  }

  function layer({ span, step, blades, width, segments, spread, heights, channel, wind, base, tip, dry, seed, seedHeads = 0, seedColor = [0.62, 0.5, 0.26] }) {
    const geo = clumpGeometry(blades, width, segments, spread, seed, seedHeads);
    const n = Math.floor((span * reach) / step);
    const random = rng(seed * 7 + 1);
    const inst = new Float32Array(n * n * 4);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const o = (j * n + i) * 4;
        inst[o] = (i + random()) * step;
        inst[o + 1] = (j + random()) * step;
        inst[o + 2] = random();
        inst[o + 3] = random() * 0.98 + 0.01;
      }
    }
    geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    geo.instanceCount = n * n;
    const material = new THREE.ShaderMaterial({
      vertexShader: PARS + VERT_MAIN.replace('VERTEX_BODY', VERTEX),
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        tHeight: { value: heightTex }, tVeg: { value: terrain.splat.texVeg }, tNoise: { value: terrain.noise }, tBend: shared.tBend, uCam: shared.uCam, uTime: ctx.time,
        uSpan: { value: n * step }, uHeights: { value: new THREE.Vector2(...heights) }, uChannel: { value: channel }, uWind: { value: wind }, uWindDir: shared.uWindDir, uBendCenter: shared.uBendCenter,
        uPushA: shared.uPushA, uPushB: shared.uPushB, uBaseColor: { value: new THREE.Color(...base) }, uTipColor: { value: new THREE.Color(...tip) },
        uDryColor: { value: new THREE.Color(...dry) }, uSeedColor: { value: new THREE.Color(...seedColor) }, uSunDir: { value: lighting.sunDirection }, uSunColor: { value: lighting.sunColor },
        uSkyColor: { value: lighting.grassSky }, tShadow: shared.tShadow, uShadowMatrix: shared.uShadowMatrix, uShadowOn: shared.uShadowOn,
        uCarInv: shared.uCarInv, uBody: shared.uBody,
      },
    });
    const whole = place(geo, material);
    const edge = (t) => Math.ceil((t * n) / TILES);
    const tiles = [];
    for (let tz = 0; tz < TILES; tz++) {
      for (let tx = 0; tx < TILES; tx++) {
        const i0 = edge(tx);
        const i1 = edge(tx + 1);
        const j0 = edge(tz);
        const j1 = edge(tz + 1);
        const part = new Float32Array((i1 - i0) * (j1 - j0) * 4);
        let k = 0;
        for (let j = j0; j < j1; j++) {
          part.set(inst.subarray((j * n + i0) * 4, (j * n + i1) * 4), k);
          k += (i1 - i0) * 4;
        }
        const tile = new THREE.InstancedBufferGeometry();
        tile.setAttribute('position', geo.attributes.position);
        tile.setAttribute('normal', geo.attributes.normal);
        tile.setAttribute('aBlade', geo.attributes.aBlade);
        tile.setIndex(geo.index);
        tile.setAttribute('aInst', new THREE.InstancedBufferAttribute(part, 4));
        tile.instanceCount = part.length / 4;
        const mesh = place(tile, material);
        mesh.visible = false;
        tiles.push({ mesh, x0: i0 * step, x1: i1 * step, z0: j0 * step, z1: j1 * step });
      }
    }
    return { whole, tiles, material, size: n * step, reach: spread + 0.35 + heights[1] * 1.15, top: heights[1] * 1.15 + 0.1, clump: geo.index.count / 3 };
  }

  const build = (amount) => {
    const k = Math.sqrt(amount);
    return [
      layer({ span: 84, step: 0.27 / k, blades: 5, width: 0.05, segments: 3, spread: 0.17, heights: [0.14, 0.46], channel: 0, wind: 0.55, base: [0.07, 0.13, 0.035], tip: [0.21, 0.33, 0.08], dry: [0.4, 0.37, 0.17], seed: 3 }),
      layer({ span: 120, step: 0.62 / k, blades: 6, width: 0.045, segments: 4, spread: 0.28, heights: [0.9, 1.9], channel: 1, wind: 0.5, base: [0.045, 0.085, 0.02], tip: [0.24, 0.36, 0.09], dry: [0.5, 0.43, 0.2], seed: 5, seedHeads: 0.25, seedColor: [0.36, 0.25, 0.14] }),
      layer({ span: 100, step: 0.75 / k, blades: 5, width: 0.07, segments: 3, spread: 0.24, heights: [0.5, 1.3], channel: 2, wind: 1, base: [0.015, 0.05, 0.02], tip: [0.07, 0.2, 0.05], dry: [0.12, 0.2, 0.06], seed: 8 }),
      layer({ span: 96, step: 0.4 / k, blades: 7, width: 0.03, segments: 4, spread: 0.3, heights: [0.6, 1.2], channel: 3, wind: 0.75, base: [0.055, 0.11, 0.03], tip: [0.27, 0.36, 0.1], dry: [0.52, 0.45, 0.2], seed: 13, seedHeads: 0.24, seedColor: [0.62, 0.5, 0.27] }),
    ];
  };
  let layers = build(density);
  let culling = true;
  let last = ctx.time.value;
  const stats = { tiles: 0, shown: 0, triangles: 0, all: 0 };
  const frustum = new THREE.Frustum();
  const proj = new THREE.Matrix4();
  const box = new THREE.Box3();
  const range = [0, 0];
  const spanX = [0, 0, 0, 0];
  const spanZ = [0, 0, 0, 0];

  function wrap(a, b, origin, size, out) {
    const start = (((a - origin) % size) + size) % size;
    const length = b - a;
    if (start + length <= size) {
      out[0] = origin + start;
      out[1] = origin + start + length;
      return 1;
    }
    out[0] = origin + start;
    out[1] = origin + size;
    out[2] = origin;
    out[3] = origin + start + length - size;
    return 2;
  }

  function seen(tile, L, cx, cz) {
    const nx = wrap(tile.x0, tile.x1, cx - L.size / 2, L.size, spanX);
    const nz = wrap(tile.z0, tile.z1, cz - L.size / 2, L.size, spanZ);
    const limit = L.size * 0.485 + 0.05;
    for (let a = 0; a < nx; a++) {
      const x0 = spanX[a * 2];
      const x1 = spanX[a * 2 + 1];
      const dx = Math.max(x0 - cx, 0, cx - x1);
      for (let b = 0; b < nz; b++) {
        const z0 = spanZ[b * 2];
        const z1 = spanZ[b * 2 + 1];
        const dz = Math.max(z0 - cz, 0, cz - z1);
        if (dx * dx + dz * dz > limit * limit) continue;
        heightRange(x0 - L.reach, x1 + L.reach, z0 - L.reach, z1 + L.reach, range);
        box.min.set(x0 - L.reach, range[0] - 0.3, z0 - L.reach);
        box.max.set(x1 + L.reach, range[1] + L.top, z1 + L.reach);
        if (frustum.intersectsBox(box)) return true;
      }
    }
    return false;
  }

  return {
    group,
    stats,
    get meshes() {
      return layers.map((L) => L.whole);
    },
    get culling() {
      return culling;
    },
    set culling(on) {
      culling = !!on;
    },
    get density() {
      return density;
    },
    setDetail(amount, far = 1) {
      if (amount === density && far === reach) return;
      density = amount;
      reach = far;
      for (const L of layers) {
        for (const mesh of [L.whole, ...L.tiles.map((t) => t.mesh)]) {
          group.remove(mesh);
          mesh.geometry.dispose();
        }
        L.material.dispose();
      }
      layers = build(density);
    },
    setShadow(texture, matrix) {
      shared.tShadow.value = texture;
      shared.uShadowMatrix.value.copy(matrix);
      shared.uShadowOn.value = 1;
    },
    press(stamp) {
      bend.press(stamp);
    },
    cull(camera) {
      stats.tiles = stats.shown = stats.triangles = stats.all = 0;
      if (culling) {
        camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      const cx = shared.uCam.value.x;
      const cz = shared.uCam.value.z;
      for (const L of layers) {
        L.whole.visible = !culling;
        stats.all += L.whole.geometry.instanceCount * L.clump;
        for (const tile of L.tiles) {
          const on = culling && seen(tile, L, cx, cz);
          tile.mesh.visible = on;
          stats.tiles++;
          if (on) {
            stats.shown++;
            stats.triangles += tile.mesh.geometry.instanceCount * L.clump;
          }
        }
      }
      if (!culling) stats.triangles = stats.all;
    },
    update(camera, pushA, pushB, carMatrixWorld, body) {
      shared.uCam.value.copy(camera);
      if (pushA) shared.uPushA.value.copy(pushA);
      if (pushB) shared.uPushB.value.copy(pushB);
      if (carMatrixWorld) shared.uCarInv.value.copy(carMatrixWorld).invert();
      if (body) shared.uBody.value.copy(body);
      const now = ctx.time.value;
      const dt = Math.min(0.1, Math.max(0, now - last));
      last = now;
      const heading = 0.64 + 0.4 * Math.sin(now * 0.045) + 0.12 * Math.sin(now * 0.21);
      shared.uWindDir.value.set(Math.cos(heading), Math.sin(heading));
      bend.update(camera.x, camera.z, dt);
      shared.tBend.value = bend.texture;
    },
  };
}
