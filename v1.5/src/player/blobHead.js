// Costa del Gzowo: trained 3D Gaussian head (blobs riding the skinned head vertices), drawn in the transparent pass and lit by the scene sun, sky and shadows.
import * as THREE from 'three';
import { LAYERS } from '../config.js';

const PER_ROW = 512;
const VERT_ROW = 256;
const C0 = 0.28209479177387814;
const C1 = 0.4886025119029199;
const WIDTHS = 12;

const VS = `
uniform sampler2D uBlob;
uniform sampler2D uTri;
uniform sampler2D uVert;
uniform sampler2D tShadow;
uniform vec2 uViewport;
uniform mat3 uColorM;
uniform vec3 uColorB;
uniform mat3 uShRot;
uniform vec3 uLight[9];
uniform vec3 uAmb[6];
uniform vec3 uHeadCenter;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVis;
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform mat4 uHeadInv;
uniform vec3 uOrigin;
uniform vec3 uCamRel;
uniform vec4 uHoodPlane;
uniform vec2 uHoodY;
uniform float uHoodW[${WIDTHS}];
uniform float uGain;
in float aIdx;
out vec4 vCol;
out vec2 vUv;
vec4 blobTexel(int i, int k) { int t = (i % ${PER_ROW}) * 7 + k; return texelFetch(uBlob, ivec2(t, i / ${PER_ROW}), 0); }
vec3 vertex(int v) { return texelFetch(uVert, ivec2(v % ${VERT_ROW}, v / ${VERT_ROW}), 0).xyz; }
vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.x * b.x - a.y * b.y - a.z * b.z - a.w * b.w,
    a.x * b.y + a.y * b.x + a.z * b.w - a.w * b.z,
    a.x * b.z - a.y * b.w + a.z * b.x + a.w * b.y,
    a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x);
}
vec4 toQuat(vec3 e1, vec3 e2, vec3 n) {
  float w = sqrt(max(1.0 + e1.x + e2.y + n.z, 1e-8)) * 0.5;
  float x = sqrt(max(1.0 + e1.x - e2.y - n.z, 1e-8)) * 0.5;
  float y = sqrt(max(1.0 - e1.x + e2.y - n.z, 1e-8)) * 0.5;
  float z = sqrt(max(1.0 - e1.x - e2.y + n.z, 1e-8)) * 0.5;
  x = e2.z - n.y >= 0.0 ? x : -x;
  y = n.x - e1.z >= 0.0 ? y : -y;
  z = e1.y - e2.x >= 0.0 ? z : -z;
  return vec4(w, x, y, z);
}
mat3 rotOf(vec4 q) {
  float w = q.x, x = q.y, y = q.z, z = q.w;
  return mat3(
    vec3(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y + w * z), 2.0 * (x * z - w * y)),
    vec3(2.0 * (x * y - w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z + w * x)),
    vec3(2.0 * (x * z + w * y), 2.0 * (y * z - w * x), 1.0 - 2.0 * (x * x + y * y)));
}
vec3 ambient(vec3 d) {
  vec3 q = d * d;
  return q.x * (d.x >= 0.0 ? uAmb[0] : uAmb[1]) + q.y * (d.y >= 0.0 ? uAmb[2] : uAmb[3]) + q.z * (d.z >= 0.0 ? uAmb[4] : uAmb[5]);
}
float hoodLight(vec3 p, vec3 l) {
  if (uHoodPlane.w < 0.5) return 1.0;
  float k = uHoodPlane.z;
  float f = (p.z - uHoodPlane.y) - k * (p.y - uHoodPlane.x);
  if (f >= 0.0) return 1.0;
  float denom = l.z - k * l.y;
  if (denom < 0.03) return 0.0;
  vec3 q = p + l * (-f / denom);
  float fi = clamp((q.y - uHoodY.x) / (uHoodY.y - uHoodY.x), 0.0, 1.0) * float(${WIDTHS - 1});
  int i0 = int(floor(fi));
  int i1 = min(i0 + 1, ${WIDTHS - 1});
  float w = mix(uHoodW[i0], uHoodW[i1], fract(fi));
  float side = smoothstep(-0.008, 0.014, w - abs(q.x));
  float top = smoothstep(-0.006, 0.014, uHoodY.y - q.y);
  float bottom = smoothstep(-0.03, 0.0, q.y - uHoodY.x);
  return side * top * bottom * smoothstep(0.03, 0.22, denom);
}
void main() {
  int i = int(aIdx + 0.5);
  vec4 tv = texelFetch(uTri, ivec2(i % ${PER_ROW}, i / ${PER_ROW}), 0);
  vec3 a = vertex(int(tv.x + 0.5));
  vec3 b = vertex(int(tv.y + 0.5));
  vec3 c = vertex(int(tv.z + 0.5));
  vec4 d0 = blobTexel(i, 0); vec4 d1 = blobTexel(i, 1); vec4 d2 = blobTexel(i, 2); vec4 d3 = blobTexel(i, 3);
  vec4 d4 = blobTexel(i, 4); vec4 d5 = blobTexel(i, 5); vec4 d6 = blobTexel(i, 6);
  vec3 e1 = normalize(b - a);
  vec3 n = normalize(cross(b - a, c - a));
  vec3 e2 = cross(n, e1);
  vec3 mean = d0.x * a + d0.y * b + d0.z * c + e1 * d0.w + e2 * d1.x + n * d1.y;
  mat3 R = rotOf(normalize(qmul(toQuat(e1, e2, n), vec4(d1.z, d1.w, d2.x, d2.y))));
  vec3 s = vec3(d2.z, d2.w, d3.x);
  float opacity = min(d3.y, 0.99);
  mat3 M = mat3(R[0] * s.x, R[1] * s.y, R[2] * s.z);
  mat3 sigma = M * transpose(M);
  vec4 tv4 = vec4(mat3(viewMatrix) * (mean - uCamRel), 1.0);
  vec3 t = tv4.xyz;
  float z = -t.z;
  vCol = vec4(0.0);
  vUv = vec2(0.0);
  if (z < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float fx = projectionMatrix[0][0] * uViewport.x * 0.5;
  float fy = projectionMatrix[1][1] * uViewport.y * 0.5;
  float limx = 1.3 * 0.5 * uViewport.x / fx;
  float limy = 1.3 * 0.5 * uViewport.y / fy;
  float tx = clamp(t.x / z, -limx, limx) * z;
  float ty = clamp(t.y / z, -limy, limy) * z;
  mat3 J = mat3(vec3(fx / z, 0.0, 0.0), vec3(0.0, fy / z, 0.0), vec3(fx * tx / (z * z), fy * ty / (z * z), 0.0));
  mat3 T = J * mat3(viewMatrix);
  mat3 cov = T * sigma * transpose(T);
  float ca = cov[0][0] + 0.3;
  float cb = cov[0][1];
  float cd = cov[1][1] + 0.3;
  float mid = 0.5 * (ca + cd);
  float rad = sqrt(max(0.25 * (ca - cd) * (ca - cd) + cb * cb, 0.0));
  float l1 = mid + rad;
  float l2 = max(mid - rad, 0.05);
  vec2 v1 = vec2(1.0, 0.0);
  if (abs(cb) > 1e-9) v1 = normalize(vec2(cb, l1 - ca)); else if (cd > ca) v1 = vec2(0.0, 1.0);
  vec2 v2 = vec2(-v1.y, v1.x);
  float r = clamp(sqrt(2.0 * log(max(255.0 * opacity, 1.0))), 0.0, 3.0);
  vec2 corner = position.xy * r;
  vec2 px = corner.x * v1 * sqrt(l1) + corner.y * v2 * sqrt(l2);
  vec4 clip = projectionMatrix * tv4;
  gl_Position = clip + vec4(px / (0.5 * uViewport) * clip.w, 0.0, 0.0);
  vec3 dir = uShRot * normalize(mean - uCamRel);
  vec3 sh0 = vec3(d3.z, d3.w, d4.x);
  vec3 sh1 = d4.yzw;
  vec3 sh2 = d5.xyz;
  vec3 sh3 = vec3(d5.w, d6.x, d6.y);
  vec3 nl = vec3(d6.z, d6.w, 1.0 - abs(d6.z) - abs(d6.w));
  float fold = max(-nl.z, 0.0);
  nl.x += nl.x >= 0.0 ? -fold : fold;
  nl.y += nl.y >= 0.0 ? -fold : fold;
  vec3 nv = mat3(viewMatrix) * normalize(e1 * nl.x + e2 * nl.y + n * nl.z);
  vec3 nc = vec3(nv.x, -nv.y, -nv.z);
  vec3 shade = max(uLight[0] * ${C0} + uLight[1] * (${C1} * nc.y) + uLight[2] * (${C1} * nc.z) + uLight[3] * (${C1} * nc.x)
    + uLight[4] * (1.0925484305920792 * nc.x * nc.y) + uLight[5] * (1.0925484305920792 * nc.y * nc.z)
    + uLight[6] * (0.31539156525252005 * (3.0 * nc.z * nc.z - 1.0)) + uLight[7] * (1.0925484305920792 * nc.x * nc.z)
    + uLight[8] * (0.5462742152960396 * (nc.x * nc.x - nc.y * nc.y)), vec3(0.02));
  vec3 rgb = max((${C0} * sh0 + 0.5) * shade + ${C1} * (-dir.y * sh1 + dir.z * sh2 - dir.x * sh3), 0.0);
  vec3 lin = pow(clamp(uColorM * rgb + uColorB, 0.0, 1.0), vec3(2.2));
  float lit = uSunVis;
  if (uShadowOn > 0.5) {
    vec4 sc = uShadowMatrix * vec4(mean + uOrigin + uSunDir * 0.06, 1.0);
    if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) lit *= step(sc.z - 0.0012, texture(tShadow, sc.xy).r);
  }
  lit *= hoodLight((uHeadInv * vec4(mean, 1.0)).xyz, normalize(mat3(uHeadInv) * uSunDir));
  vec3 no = dot(n, mean - uHeadCenter) < 0.0 ? -n : n;
  float wrap = clamp((dot(no, uSunDir) + 0.28) / 1.28, 0.0, 1.0);
  vec3 light = uSunColor * (wrap * wrap * lit * 0.31830989) + ambient(no);
  vCol = vec4(lin * light * uGain, opacity);
  vUv = corner;
}
`;

const FS = `
in vec4 vCol;
in vec2 vUv;
layout(location = 0) out highp vec4 blobColor;
void main() {
  float a = vCol.a * exp(-0.5 * dot(vUv, vUv));
  if (a < 1.0 / 255.0) discard;
  blobColor = vec4(vCol.rgb * a, a);
}
`;

const SORTER = `
let corners, params, nb, keys, depth, counts;
onmessage = (e) => {
  const m = e.data;
  if (m.init) { corners = m.corners; params = m.params; nb = m.nb; keys = new Uint16Array(nb); depth = new Float32Array(nb); counts = new Uint32Array(65537); return; }
  const v = m.verts, c = m.cam;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < nb; i++) {
    const a = corners[i * 3] * 4, b = corners[i * 3 + 1] * 4, cc = corners[i * 3 + 2] * 4, o = i * 5;
    const ax = v[a], ay = v[a + 1], az = v[a + 2];
    const ux = v[b] - ax, uy = v[b + 1] - ay, uz = v[b + 2] - az;
    const wx = v[cc] - ax, wy = v[cc + 1] - ay, wz = v[cc + 2] - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const ul = Math.hypot(ux, uy, uz) || 1;
    const e1x = ux / ul, e1y = uy / ul, e1z = uz / ul;
    const e2x = ny * e1z - nz * e1y, e2y = nz * e1x - nx * e1z, e2z = nx * e1y - ny * e1x;
    const b1 = params[o], b2 = params[o + 1], ox = params[o + 2], oy = params[o + 3], oz = params[o + 4];
    const px = ax + b1 * ux + b2 * wx + e1x * ox + e2x * oy + nx * oz;
    const py = ay + b1 * uy + b2 * wy + e1y * ox + e2y * oy + ny * oz;
    const pz = az + b1 * uz + b2 * wz + e1z * ox + e2z * oy + nz * oz;
    const d = (px - c[0]) * c[3] + (py - c[1]) * c[4] + (pz - c[2]) * c[5];
    depth[i] = d;
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  const k = 65535 / Math.max(hi - lo, 1e-6);
  counts.fill(0);
  for (let i = 0; i < nb; i++) { const q = 65535 - Math.min(65535, Math.max(0, ((depth[i] - lo) * k) | 0)); keys[i] = q; counts[q + 1]++; }
  for (let q = 1; q < 65537; q++) counts[q] += counts[q - 1];
  const order = new Float32Array(nb);
  for (let i = 0; i < nb; i++) order[counts[keys[i]]++] = i;
  postMessage({ order, verts: v }, [order.buffer, v.buffer]);
};
`;

function dataTexture(data, width, height, type) {
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, type);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export async function createBlobHead({ base, bones, lighting, parent }) {
  const [meta, buf] = await Promise.all([
    fetch(base + 'head.json').then((r) => r.json()),
    fetch(base + 'head.bin').then((r) => r.arrayBuffer()),
  ]);
  const nv = meta.nv;
  const nb = meta.nb;
  const rest = new Float32Array(buf, meta.offsets.rest, nv * 3);
  const skinW = new Float32Array(buf, meta.offsets.skinWeight, nv * 4);
  const skinI = new Uint8Array(buf, meta.offsets.skinIndex, nv * 4);
  const corners = new Uint16Array(buf, meta.offsets.corners, nb * 3);
  const blob = new Uint16Array(buf, meta.offsets.blob, nb * 28);

  const rigBones = meta.bones.map((name) => {
    const bone = bones.get(name);
    if (!bone) throw new Error('blob head: missing bone ' + name);
    return bone;
  });
  const inverseBinds = meta.inverseBinds.map((m) => new THREE.Matrix4().fromArray(m));
  const headSlot = meta.bones.indexOf('Head');

  const vRows = Math.ceil(nv / VERT_ROW);
  const vertData = new Float32Array(VERT_ROW * vRows * 4);
  const vertTex = dataTexture(vertData, VERT_ROW, vRows, THREE.FloatType);
  const bRows = Math.ceil(nb / PER_ROW);
  const blobData = new Uint16Array(PER_ROW * 7 * bRows * 4);
  blobData.set(blob);
  const triData = new Float32Array(PER_ROW * bRows * 4);
  for (let i = 0; i < nb; i++) {
    triData[i * 4] = corners[i * 3];
    triData[i * 4 + 1] = corners[i * 3 + 1];
    triData[i * 4 + 2] = corners[i * 3 + 2];
  }

  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
  quad.setIndex([0, 1, 2, 2, 1, 3]);
  const order = new Float32Array(nb);
  for (let i = 0; i < nb; i++) order[i] = i;
  const orderAttr = new THREE.InstancedBufferAttribute(order, 1);
  orderAttr.setUsage(THREE.DynamicDrawUsage);
  quad.setAttribute('aIdx', orderAttr);
  quad.instanceCount = nb;

  const cm = meta.color;
  const hood = meta.hood && meta.hood.widths ? meta.hood : null;
  const sun = lighting.sunDepth;
  const uniforms = {
    uBlob: { value: dataTexture(blobData, PER_ROW * 7, bRows, THREE.HalfFloatType) },
    uTri: { value: dataTexture(triData, PER_ROW, bRows, THREE.FloatType) },
    uVert: { value: vertTex },
    tShadow: { value: sun ? sun.texture : null },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uColorM: { value: new THREE.Matrix3().set(cm[0], cm[1], cm[2], cm[3], cm[4], cm[5], cm[6], cm[7], cm[8]) },
    uColorB: { value: new THREE.Vector3(cm[9], cm[10], cm[11]) },
    uShRot: { value: new THREE.Matrix3() },
    uLight: { value: Array.from({ length: 9 }, (_, k) => (meta.light ? new THREE.Vector3(...meta.light[k]) : new THREE.Vector3().setScalar(k ? 0 : 1 / C0))) },
    uAmb: { value: lighting.ambientCube().map((v) => v.clone()) },
    uHeadCenter: { value: new THREE.Vector3() },
    uSunDir: { value: lighting.sunDirection.clone() },
    uSunColor: { value: new THREE.Vector3(lighting.sunColor.r, lighting.sunColor.g, lighting.sunColor.b) },
    uSunVis: { value: 1 },
    uShadowMatrix: { value: sun ? sun.matrix.clone() : new THREE.Matrix4() },
    uShadowOn: { value: sun ? 1 : 0 },
    uHeadInv: { value: new THREE.Matrix4() },
    uOrigin: { value: new THREE.Vector3() },
    uCamRel: { value: new THREE.Vector3() },
    uHoodPlane: { value: hood ? new THREE.Vector4(hood.cy, hood.cz, hood.slope, 1) : new THREE.Vector4() },
    uHoodY: { value: hood ? new THREE.Vector2(hood.yLo, hood.yHi) : new THREE.Vector2(0, 1) },
    uHoodW: { value: hood ? hood.widths.slice(0, WIDTHS) : new Array(WIDTHS).fill(1) },
    uGain: { value: 0.5 },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: FS, uniforms,
    transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(quad, material);
  mesh.name = 'BlobHead';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.layers.set(LAYERS.WATER);
  parent.add(mesh);

  const sortParams = new Float32Array(nb * 5);
  const sortCorners = new Uint32Array(nb * 3);
  for (let i = 0; i < nb; i++) {
    for (let k = 0; k < 5; k++) sortParams[i * 5 + k] = THREE.DataUtils.fromHalfFloat(blob[i * 28 + 1 + k]);
    sortCorners[i * 3] = corners[i * 3];
    sortCorners[i * 3 + 1] = corners[i * 3 + 1];
    sortCorners[i * 3 + 2] = corners[i * 3 + 2];
  }
  const stats = { blobs: nb, lastMs: 0, sorts: 0, drawn: 0 };
  const worker = new Worker(URL.createObjectURL(new Blob([SORTER], { type: 'text/javascript' })));
  worker.postMessage({ init: true, corners: sortCorners, params: sortParams, nb }, [sortCorners.buffer, sortParams.buffer]);
  let busy = false;
  const pool = [];
  const lastCam = new Float32Array(6);
  let lastSum = NaN;
  worker.onmessage = (e) => {
    order.set(e.data.order);
    orderAttr.needsUpdate = true;
    pool.push(e.data.verts);
    busy = false;
    stats.sorts++;
  };

  const A = new THREE.Matrix3().set(1, 0, 0, 0, 0, -1, 0, 1, 0);
  const comb = new Float64Array(rigBones.length * 12);
  const origin = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const headMatrix = new THREE.Matrix4();
  const shR = new THREE.Matrix3();
  const size = new THREE.Vector2();
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const center = new THREE.Vector3();
  const forward = new THREE.Vector3();

  function skin() {
    origin.setFromMatrixPosition(rigBones[headSlot].matrixWorld);
    for (let j = 0; j < rigBones.length; j++) {
      const e = m4.multiplyMatrices(rigBones[j].matrixWorld, inverseBinds[j]).elements;
      const o = j * 12;
      comb[o] = e[0]; comb[o + 1] = e[4]; comb[o + 2] = e[8]; comb[o + 3] = e[12] - origin.x;
      comb[o + 4] = e[1]; comb[o + 5] = e[5]; comb[o + 6] = e[9]; comb[o + 7] = e[13] - origin.y;
      comb[o + 8] = e[2]; comb[o + 9] = e[6]; comb[o + 10] = e[10]; comb[o + 11] = e[14] - origin.z;
      if (j === headSlot) {
        headMatrix.copy(m4);
        headMatrix.elements[12] -= origin.x;
        headMatrix.elements[13] -= origin.y;
        headMatrix.elements[14] -= origin.z;
      }
    }
    for (let i = 0; i < nv; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      let ox = 0, oy = 0, oz = 0;
      for (let k = 0; k < 4; k++) {
        const w = skinW[i * 4 + k];
        if (!w) continue;
        const o = skinI[i * 4 + k] * 12;
        ox += w * (comb[o] * x + comb[o + 1] * y + comb[o + 2] * z + comb[o + 3]);
        oy += w * (comb[o + 4] * x + comb[o + 5] * y + comb[o + 6] * z + comb[o + 7]);
        oz += w * (comb[o + 8] * x + comb[o + 9] * y + comb[o + 10] * z + comb[o + 11]);
      }
      vertData[i * 4] = ox; vertData[i * 4 + 1] = oy; vertData[i * 4 + 2] = oz;
    }
    vertTex.needsUpdate = true;
  }

  mesh.onBeforeRender = (renderer, _scene, camera) => {
    const t0 = performance.now();
    skin();
    shR.setFromMatrix4(headMatrix).transpose();
    uniforms.uShRot.value.copy(A).multiply(shR);
    uniforms.uHeadInv.value.copy(headMatrix).invert();
    uniforms.uHeadCenter.value.set(0, meta.dz + 0.02, 0).applyMatrix4(headMatrix);
    const rt = renderer.getRenderTarget();
    if (rt) size.set(rt.width, rt.height);
    else renderer.getDrawingBufferSize(size);
    uniforms.uViewport.value.copy(size);
    camera.getWorldPosition(camPos).sub(origin);
    camera.getWorldDirection(camDir);
    uniforms.uOrigin.value.copy(origin);
    uniforms.uCamRel.value.copy(camPos);
    let sum = 0;
    for (let i = 0; i < vertData.length; i += 389) sum += vertData[i];
    const cam = [camPos.x, camPos.y, camPos.z, camDir.x, camDir.y, camDir.z];
    const moved = sum !== lastSum || cam.some((c, k) => Math.abs(c - lastCam[k]) > 1e-5);
    if (!busy && moved) {
      busy = true;
      lastSum = sum;
      lastCam.set(cam);
      let vbuf = pool.pop();
      if (!vbuf || vbuf.length !== vertData.length) vbuf = new Float32Array(vertData.length);
      vbuf.set(vertData);
      worker.postMessage({ verts: vbuf, cam }, [vbuf.buffer]);
    }
    stats.lastMs = +(performance.now() - t0).toFixed(1);
    stats.drawn++;
  };

  return {
    mesh,
    meta,
    stats,
    uniforms,
    update(camera) {
      headMatrix.multiplyMatrices(rigBones[headSlot].matrixWorld, inverseBinds[headSlot]);
      center.set(0, meta.dz + 0.02, 0.02).applyMatrix4(headMatrix);
      forward.set(0, 0, 1).transformDirection(headMatrix);
      camPos.setFromMatrixPosition(camera.matrixWorld).sub(center);
      const distance = camPos.length();
      mesh.visible = distance < 70 && camPos.dot(forward) / Math.max(distance, 1e-4) > -0.45;
    },
    setSunVisibility(v) {
      uniforms.uSunVis.value = v;
    },
    setGain(g) {
      uniforms.uGain.value = g;
    },
    dispose() {
      worker.terminate();
      parent.remove(mesh);
      quad.dispose();
      material.dispose();
      for (const u of ['uBlob', 'uTri', 'uVert']) uniforms[u].value.dispose();
    },
  };
}
