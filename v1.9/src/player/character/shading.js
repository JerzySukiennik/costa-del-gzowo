// Costa del Gzowo: avatar materials (skin, eyes, hair, jersey tee, denim, sneakers, accessories) with rest-space procedural detail.
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';
import { EYE } from './sculptHead.js';

const f = (v) => v.toFixed(5);

const VERT_PARS = `
attribute vec4 aData;
varying vec4 vData;
varying vec3 vRest;
varying vec3 vRestN;
`;

const VERT = `
vData = aData;
vRest = position;
vRestN = normal;
`;

const FRAG_PARS = `
varying vec4 vData;
varying vec3 vRest;
varying vec3 vRestN;
float chHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float chNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 q = fract(p);
  q = q * q * (3.0 - 2.0 * q);
  return mix(mix(mix(chHash(i), chHash(i + vec3(1.0, 0.0, 0.0)), q.x), mix(chHash(i + vec3(0.0, 1.0, 0.0)), chHash(i + vec3(1.0, 1.0, 0.0)), q.x), q.y),
             mix(mix(chHash(i + vec3(0.0, 0.0, 1.0)), chHash(i + vec3(1.0, 0.0, 1.0)), q.x), mix(chHash(i + vec3(0.0, 1.0, 1.0)), chHash(i + vec3(1.0, 1.0, 1.0)), q.x), q.y), q.z);
}
float chFbm(vec3 p) {
  return 0.5 * chNoise(p) + 0.25 * chNoise(p * 2.03 + 1.7) + 0.125 * chNoise(p * 4.01 + 3.1);
}
float chFade(float freq) {
  return 1.0 - smoothstep(0.35, 1.2, length(fwidth(vRest)) * freq);
}
vec3 chBump(vec3 n, float h) {
  vec3 sp = -vViewPosition;
  vec3 dpx = dFdx(sp);
  vec3 dpy = dFdy(sp);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 r1 = cross(dpy, n);
  vec3 r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - g);
}
`;

function make(ctx, Kind, params, key, hooks) {
  const m = new Kind(params);
  hookMaterial(m, { ...hooks, key: 'character-' + key, dynamic: true, pars: VERT_PARS, vertex: VERT, fragPars: FRAG_PARS + (hooks.pars || ''), uniforms: hooks.uniforms || {} });
  ctx.lighting.register(m);
  return m;
}

const HAIR_RGB = 'vec3(0.032, 0.022, 0.016)';

export function skinMaterial(ctx) {
  const ex = f(EYE.x);
  const ey = f(EYE.y);
  const ez = f(EYE.z);
  const pars = `
float chLip(vec3 h, out float line) {
  float sx = abs(h.x);
  float front = smoothstep(0.072, 0.082, h.z);
  float up = 0.0086 - 7.5 * sx * sx + 0.0011 * exp(-pow((sx - 0.0062) / 0.0028, 2.0)) - 0.0013 * exp(-pow(sx / 0.0026, 2.0));
  float lo = -0.0172 + 15.0 * sx * sx;
  float m = front * smoothstep(0.027, 0.0235, sx) * smoothstep(up + 0.0009, up - 0.0005, h.y) * smoothstep(lo - 0.0009, lo + 0.0006, h.y);
  line = front * smoothstep(0.0012, 0.0003, abs(h.y + 0.0024 + 2.5 * sx * sx)) * smoothstep(0.0265, 0.021, sx);
  return m;
}
float chBrow(vec3 h) {
  float sx = abs(h.x);
  float u = clamp((sx - 0.011) / 0.047, 0.0, 1.0);
  float by = 0.0935 + 0.0065 * sin(u * 2.4) - 0.0035 * u * u;
  float th = mix(0.0068, 0.0032, u);
  float m = step(0.011, sx) * smoothstep(0.06, 0.054, sx) * smoothstep(th, th * 0.45, abs(h.y - by)) * smoothstep(0.05, 0.062, h.z);
  float strands = chNoise(vec3(sx * 700.0, (h.y - by) * 220.0 + sx * 90.0, h.z * 300.0));
  return clamp(m * (0.45 + 0.75 * strands), 0.0, 1.0);
}
float chLash(vec3 h) {
  float s = sign(h.x);
  vec3 q = h - vec3(s * ${ex}, ${ey}, ${ez});
  float x = q.x * s;
  float u = (x + 0.0012) / ${f(EYE.w)};
  float shape = max(0.0, 1.0 - u * u);
  float lift = 0.0009 * u + x * ${f(EYE.tilt)};
  float top = ${f(EYE.up)} * pow(shape, 0.8) + lift;
  float bot = -${f(EYE.down)} * pow(shape, 0.9) + lift * 0.6 - 0.0006;
  float near = step(0.0, q.z + 0.006) * smoothstep(0.0175, 0.0155, length(q));
  float upper = smoothstep(0.0022, 0.0005, abs(q.y - top + 0.0003)) * smoothstep(1.1, 0.85, abs(u));
  float lower = smoothstep(0.0011, 0.0003, abs(q.y - bot)) * smoothstep(1.02, 0.7, abs(u)) * 0.45;
  float crease = smoothstep(0.0028, 0.0008, abs(q.y - top - 0.0042 - 0.002 * shape)) * smoothstep(1.1, 0.6, abs(u)) * 0.25;
  return near * clamp(upper + lower, 0.0, 1.0) + near * crease;
}
`;
  const color = `
{
  vec3 P = vRest;
  vec3 h = P - vec3(0.0, 1.6, 0.0);
  vec3 c = diffuseColor.rgb;
  float mott = chFbm(P * 38.0);
  c *= 0.9 + 0.17 * mott;
  c = mix(c, c * vec3(1.1, 0.84, 0.8), vData.x * 0.55);
  float lineM;
  float lip = chLip(h, lineM);
  c = mix(c, c * vec3(0.92, 0.62, 0.6), lip * 0.8);
  c *= 1.0 - lineM * 0.55;
  float brow = chBrow(h);
  c = mix(c, ${HAIR_RGB} * 1.6, brow * 0.92);
  float dots = smoothstep(0.52, 0.78, chNoise(P * 2400.0)) * chFade(2400.0) + 0.35 * (1.0 - chFade(2400.0));
  c = mix(c, c * vec3(0.82, 0.8, 0.8), vData.y * 0.5);
  c = mix(c, ${HAIR_RGB}, vData.y * dots * 0.55);
  float hd = smoothstep(0.45, 0.7, chNoise(P * 1600.0)) * chFade(1600.0) + 0.4 * (1.0 - chFade(1600.0));
  c = mix(c, ${HAIR_RGB}, vData.z * (0.3 + 0.55 * hd));
  c = mix(c, vec3(0.86, 0.68, 0.62), vData.w * 0.8);
  if (P.y > 1.6) c *= 1.0 - chLash(h) * 0.88;
  float phil = smoothstep(0.004, 0.0, abs(h.x)) * smoothstep(0.004, 0.012, h.y) * smoothstep(0.022, 0.016, h.y) * smoothstep(0.085, 0.092, h.z);
  c *= 1.0 - phil * 0.08;
  float nlf = smoothstep(0.004, 0.0, abs(length(vec2(abs(h.x) - 0.012, h.y - 0.03) * vec2(1.0, 0.8)) - 0.024)) * smoothstep(0.0, 0.03, -h.y + 0.03) * step(0.017, abs(h.x)) * smoothstep(0.07, 0.085, h.z);
  c *= 1.0 - nlf * 0.1;
  diffuseColor.rgb = c;
}
`;
  const rough = `
{
  vec3 h = vRest - vec3(0.0, 1.6, 0.0);
  float tz = smoothstep(0.03, 0.0, length(h.xy - vec2(0.0, 0.07)) - 0.03) * smoothstep(0.05, 0.09, h.z);
  float lineM;
  float lip = chLip(h, lineM);
  roughnessFactor = roughnessFactor - tz * 0.12 - lip * 0.16 + vData.y * 0.12 - vData.w * 0.25 + (chNoise(vRest * 300.0) - 0.5) * 0.08;
}
`;
  const normal = `
{
  float amp = chFade(900.0);
  float hgt = (chNoise(vRest * 900.0) * 0.00012 + chNoise(vRest * 2600.0) * 0.00004 * chFade(2600.0)) * amp;
  hgt += chFbm(vRest * vec3(60.0, 160.0, 60.0)) * 0.00025;
  normal = chBump(normal, hgt);
}
`;
  return make(ctx, THREE.MeshPhysicalMaterial, {
    color: new THREE.Color(0xa87a5f), roughness: 0.5, specularIntensity: 0.55, sheen: 0.25, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.85, 0.45, 0.35),
  }, 'skin', { pars, color, rough, normal });
}

export function eyeMaterial(ctx) {
  const color = `
{
  vec3 e = normalize(vData.xyz);
  float th = acos(clamp(e.z, -1.0, 1.0));
  float ang = atan(e.y, e.x * vData.w);
  float iris = smoothstep(0.52, 0.49, th);
  float pupil = smoothstep(0.2, 0.18, th);
  float radial = chNoise(vec3(ang * 14.0, th * 30.0, 0.0)) * 0.6 + chNoise(vec3(ang * 40.0, th * 8.0, 3.0)) * 0.4;
  vec3 ic = mix(vec3(0.13, 0.08, 0.035), vec3(0.36, 0.25, 0.1), radial);
  ic = mix(ic, vec3(0.2, 0.16, 0.07), smoothstep(0.25, 0.4, th) * 0.5);
  ic *= mix(1.0, 0.45, smoothstep(0.4, 0.5, th));
  vec3 sc = vec3(0.86, 0.82, 0.78) * mix(1.0, 0.6, smoothstep(0.7, 1.4, th));
  sc = mix(sc, vec3(0.8, 0.55, 0.5), smoothstep(0.9, 1.5, th) * chNoise(vec3(ang * 20.0, th * 6.0, 1.0)) * 0.6);
  vec3 c = mix(sc, ic, iris);
  c = mix(c, vec3(0.015), pupil);
  diffuseColor.rgb = c;
}
`;
  return make(ctx, THREE.MeshPhysicalMaterial, { color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 0.3 }, 'eye', { color });
}

export function hairMaterial(ctx) {
  const color = `
{
  vec3 P = vRest;
  vec3 crown = vec3(0.0, 1.765, -0.06);
  vec3 d = normalize(P - crown + vec3(0.0, 0.0, 0.03));
  vec3 n = normalize(vRestN);
  vec3 t = normalize(d - n * dot(d, n));
  vec3 b = cross(n, t);
  float s1 = chNoise(vec3(dot(P, b) * 1100.0, dot(P, t) * 90.0, dot(P, n) * 300.0));
  float s2 = chNoise(vec3(dot(P, b) * 2600.0, dot(P, t) * 160.0, 1.0));
  float strand = mix(0.5, s1 * 0.6 + s2 * 0.4, chFade(1100.0));
  vec3 c = ${HAIR_RGB} * (0.7 + 0.6 * strand);
  c *= mix(0.55, 1.0, smoothstep(0.0, 0.02, vData.x));
  diffuseColor.rgb = c;
}
`;
  const normal = `
{
  vec3 P = vRest;
  vec3 crown = vec3(0.0, 1.765, -0.06);
  vec3 d = normalize(P - crown + vec3(0.0, 0.0, 0.03));
  vec3 n = normalize(vRestN);
  vec3 t = normalize(d - n * dot(d, n));
  vec3 b = cross(n, t);
  float hgt = chNoise(vec3(dot(P, b) * 900.0, dot(P, t) * 70.0, 0.0)) * 0.0006 * chFade(900.0) + chNoise(P * 160.0) * 0.0012;
  normal = chBump(normal, hgt);
}
`;
  const rough = `roughnessFactor = clamp(roughnessFactor + (chNoise(vRest * 500.0) - 0.5) * 0.25, 0.3, 0.9);`;
  return make(ctx, THREE.MeshPhysicalMaterial, { color: 0xffffff, roughness: 0.55, sheen: 0.3, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.2, 0.15, 0.11), specularIntensity: 0.45 }, 'hair', { color, normal, rough });
}

export function shirtMaterial(ctx) {
  const color = `
{
  vec3 c = diffuseColor.rgb * (0.95 + 0.07 * chFbm(vRest * 25.0));
  float hd = vData.x;
  float stitch = smoothstep(0.0009, 0.0002, abs(hd - 0.017)) + smoothstep(0.0009, 0.0002, abs(hd - 0.0215)) * 0.0;
  c *= 1.0 - stitch * 0.18;
  c *= 1.0 - smoothstep(0.004, 0.0, hd) * 0.12;
  diffuseColor.rgb = c;
}
`;
  const normal = `
{
  float knit = (chNoise(vRest * vec3(2600.0, 1100.0, 2600.0)) * 0.00005) * chFade(2600.0);
  float wr = chFbm(vRest * vec3(34.0, 95.0, 34.0)) * 0.0011 + chFbm(vRest * vec3(90.0, 220.0, 90.0)) * 0.00025;
  float hem = smoothstep(0.0225, 0.0195, vData.x) * 0.0004;
  normal = chBump(normal, knit + wr + hem);
}
`;
  return make(ctx, THREE.MeshPhysicalMaterial, { color: 0xd8d2c3, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.95, 0.93, 0.88), side: THREE.DoubleSide, specularIntensity: 0.25 }, 'tee', { color, normal });
}

export function denimMaterial(ctx, maps) {
  const pars = `
uniform sampler2D tDenim;
vec3 chDen(vec2 p) {
  vec2 q = vec2(0.475 + 0.4 * abs(fract(p.x * 0.5) * 2.0 - 1.0), p.y);
  return textureGrad(tDenim, q, dFdx(p) * 0.8, dFdy(p) * 0.8).rgb;
}
vec3 chTri(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  return chDen(p.zy) * w.x + chDen(p.xz) * w.y + chDen(p.xy) * w.z;
}
float chSeam(float d, float w) {
  return smoothstep(w, w * 0.3, abs(d));
}
`;
  const color = `
{
  vec3 P = vRest;
  vec3 tex = chTri(P * 3.2, normalize(vRestN));
  vec3 c = diffuseColor.rgb * tex;
  float sx = abs(P.x);
  float ang = vData.y;
  float along = vData.z;
  float legPart = step(P.y, 0.83);
  float fadeFront = smoothstep(0.6, 0.0, abs(ang)) * smoothstep(-0.32, -0.12, along) * smoothstep(0.0, -0.08, along);
  float seat = smoothstep(-0.03, -0.12, P.z) * smoothstep(0.84, 0.9, P.y) * (1.0 - smoothstep(0.93, 0.97, P.y));
  c = mix(c, c * vec3(1.35, 1.3, 1.22), clamp(fadeFront * 0.7 + seat * 0.4, 0.0, 1.0) * 0.6);
  c *= 0.92 + 0.12 * chFbm(P * 18.0);
  float hd = vData.x;
  float thread = 0.0;
  thread += chSeam(hd - 0.006, 0.0008) + chSeam(hd - 0.032, 0.0008) * step(0.94, P.y);
  float sideSeam = chSeam((abs(ang) - 1.5708) * 0.1, 0.0016) * legPart;
  thread += chSeam((abs(ang) - 1.5708) * 0.1 - 0.0035, 0.0007) * legPart;
  c *= 1.0 - sideSeam * 0.2;
  vec2 pk = vec2((sx - 0.158) / 0.072, (P.y - 0.995) / 0.085);
  float pocketLine = chSeam(length(pk) - 1.0, 0.011) * step(0.0, P.z) * step(sx, 0.158) * step(P.y, 0.99);
  thread += pocketLine;
  c *= 1.0 - chSeam(length(pk) - 1.07, 0.06) * step(0.0, P.z) * step(sx, 0.16) * step(P.y, 0.99) * 0.25;
  float fly = step(0.0, P.z) * step(0.875, P.y) * step(P.y, 0.955) * chSeam(sx - 0.028 + smoothstep(0.9, 0.875, P.y) * 0.02, 0.0008);
  thread += fly;
  float bx = abs(sx - 0.078);
  float back = step(P.z, -0.04) * step(0.855, P.y) * step(P.y, 0.95);
  float bl = max(chSeam(bx - 0.042, 0.0009) * step(P.y, 0.945), chSeam(P.y - 0.945, 0.0009) * step(bx, 0.042));
  float tip = 0.865 + bx * 0.35;
  bl = max(bl, chSeam(P.y - tip, 0.0009) * step(bx, 0.042));
  thread += bl * back * step(tip - 0.001, P.y);
  c = mix(c, vec3(0.5, 0.36, 0.2), clamp(thread, 0.0, 1.0) * 0.6);
  if (vData.w > 1.5) c *= 0.85;
  diffuseColor.rgb = c;
}
`;
  const normal = `
{
  vec3 tex = chTri(vRest * 3.2, normalize(vRestN));
  float twill = dot(tex, vec3(0.33)) * 0.0004 * chFade(400.0);
  float wr = chFbm(vRest * vec3(30.0, 70.0, 30.0)) * 0.0012;
  normal = chBump(normal, twill + wr);
}
`;
  return make(ctx, THREE.MeshPhysicalMaterial, { color: 0xc4cad6, roughness: 0.92, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color(0.55, 0.62, 0.75), side: THREE.DoubleSide, specularIntensity: 0.2 }, 'denim', { pars, color, normal, uniforms: { tDenim: { value: maps.map } } });
}

export function shoeMaterial(ctx) {
  const color = `
{
  vec3 L = vData.yzw;
  vec3 c = vec3(0.84, 0.83, 0.8);
  float sole = smoothstep(-0.0335, -0.0345, L.y);
  float outsole = smoothstep(-0.0545, -0.0555, L.y);
  c = mix(c, vec3(0.8, 0.78, 0.73), sole);
  c = mix(c, vec3(0.58, 0.4, 0.23), outsole);
  c *= 1.0 - smoothstep(0.0007, 0.0002, abs(L.y + 0.0425)) * 0.25 * sole;
  float stitch = smoothstep(0.0006, 0.0002, abs(L.y + 0.0285)) * (1.0 - sole);
  c *= 1.0 - stitch * 0.15;
  float tab = smoothstep(-0.045, -0.055, L.z) * smoothstep(-0.03, -0.022, L.y) * (1.0 - sole);
  c = mix(c, vec3(0.08, 0.16, 0.3), tab);
  float perf = smoothstep(0.32, 0.18, length(fract(L.xz * 260.0) - 0.5)) * smoothstep(0.17, 0.2, L.z) * (1.0 - sole) * step(-0.02, L.y) * chFade(260.0);
  c *= 1.0 - perf * 0.35;
  if (vData.x > 0.5) c = vec3(0.95, 0.94, 0.92);
  diffuseColor.rgb = c * (0.96 + 0.05 * chFbm(L * 60.0));
}
`;
  const rough = `
{
  float sole = smoothstep(-0.0335, -0.0345, vData.z);
  roughnessFactor = mix(0.42, 0.75, sole) + (vData.x > 0.5 ? 0.35 : 0.0);
}
`;
  const normal = `
{
  float grain = chNoise(vData.yzw * 900.0) * 0.00008 * chFade(900.0);
  float tread = smoothstep(-0.05, -0.06, vData.z) * sin(vData.w * 900.0) * 0.00015;
  normal = chBump(normal, grain + tread);
}
`;
  return make(ctx, THREE.MeshPhysicalMaterial, { color: 0xffffff, roughness: 0.45, side: THREE.DoubleSide, specularIntensity: 0.5 }, 'shoe', { color, rough, normal });
}

export function gearMaterial(ctx) {
  const color = 'diffuseColor.rgb = vData.rgb;';
  const rough = 'roughnessFactor = vData.a;';
  const physical = 'float steel = step(vData.a, 0.3) * step(0.3, vData.r); material.specularColor = mix(material.specularColor, vData.rgb, steel); material.diffuseColor *= 1.0 - steel;';
  return make(ctx, THREE.MeshPhysicalMaterial, { color: 0xffffff, roughness: 0.5, metalness: 0.0, clearcoat: 0.4 }, 'gear', { color, rough, physical });
}
