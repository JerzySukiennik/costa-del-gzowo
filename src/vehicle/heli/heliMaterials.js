// Costa del Gzowo helicopter: materials (livery paint with panel lines, rivets, window seals, lettering, soot; plus the shared car solids, glass and leather).
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';
import { createCarMaterials } from '../carMaterials.js';
import { K, SHAPES } from './heliBody.js';

const glsl = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const polygon = (name, shape) => {
  const pts = shape.poly;
  const pad = Array.from({ length: 6 }, (_, i) => pts[Math.min(i, pts.length - 1)]);
  return `const vec2 ${name}[6] = vec2[6](${pad.map(([x, y]) => `vec2(${glsl(+x.toFixed(4))}, ${glsl(+y.toFixed(4))})`).join(', ')});`;
};

const PARS_V = `
attribute vec2 aSkin;
attribute float aEdge;
attribute vec3 aRest;
varying vec2 vSkin;
varying float vEdge;
varying vec3 vRest;
`;
const SNIP_V = `
vSkin = aSkin;
vEdge = aEdge;
vRest = aRest;
`;
const PARS_F = `
varying vec2 vSkin;
varying float vEdge;
varying vec3 vRest;
uniform sampler2D tNoise;
uniform sampler2D tDecal;
uniform float uChar;
uniform float uDirt;
float gCoat;
float gRough;
${polygon('DOOR', SHAPES.door)}
${polygon('REAR', SHAPES.rearDoor)}
float sdPoly(vec2 p, vec2 v[6], int n) {
  float d = dot(p - v[0], p - v[0]);
  float s = 1.0;
  for (int i = 0, j = n - 1; i < n; j = i, i++) {
    vec2 e = v[j] - v[i];
    vec2 w = p - v[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
float hair(float d, float width) {
  float aa = fwidth(d) + 0.0004;
  return (1.0 - smoothstep(width, width + aa, abs(d))) * clamp(width * 3.0 / aa, 0.0, 1.0);
}
`;
const COLOR = `
{
  gCoat = 1.0;
  gRough = 0.0;
  float grit = texture2D(tNoise, vRest.xy * 0.9 + vRest.z * 0.37).r;
  if (!gl_FrontFacing && vSkin.y > -5.0) {
    diffuseColor.rgb = vec3(0.36, 0.35, 0.33) * (0.85 + 0.3 * grit);
    gCoat = 0.0;
    gRough = 0.92;
  } else if (vSkin.y > -5.0) {
    float x = vSkin.x;
    float T = abs(vSkin.y) * ${glsl(K)};
    float y = vRest.y;
    vec3 col = vec3(0.8, 0.79, 0.75);
    vec3 teal = vec3(0.012, 0.2, 0.22);
    vec3 coral = vec3(0.86, 0.25, 0.07);
    vec3 gold = vec3(0.82, 0.55, 0.12);
    float h = (x > -2.0 ? 0.98 - 0.07 * x : 1.12 + (-2.0 - x) * 0.115) + 0.05 * sin(x * 1.3 + 0.6);
    float d = y - h;
    float aa = fwidth(d) + 0.0005;
    col = mix(col, gold, smoothstep(-aa, aa, d - 0.105) * (1.0 - smoothstep(-aa, aa, d - 0.125)));
    col = mix(col, coral, 1.0 - smoothstep(-aa, aa, d - 0.075));
    col = mix(col, teal, 1.0 - smoothstep(-aa, aa, d));
    float side = vSkin.y < 0.0 ? 1.0 : 0.0;
    vec2 reg = vec2((x + 4.75) / 1.3, (y - 1.535) / 0.17);
    if (reg.x > 0.0 && reg.x < 1.0 && reg.y > 0.0 && reg.y < 1.0 && T > 0.5 && T < 1.4) {
      float a = texture2D(tDecal, vec2(mix(reg.x, 1.0 - reg.x, side), 0.5 + reg.y * 0.5)).r;
      col = mix(col, vec3(0.03, 0.05, 0.06), a);
    }
    vec2 name = vec2((x - 0.18) / 1.12, (y - 0.69) / 0.15);
    if (name.x > 0.0 && name.x < 1.0 && name.y > 0.0 && name.y < 1.0 && T > 0.9) {
      float a = texture2D(tDecal, vec2(mix(name.x, 1.0 - name.x, side), name.y * 0.5)).r;
      col = mix(col, vec3(0.86, 0.84, 0.78), a);
    }
    vec2 p = vec2(x, T);
    float line = hair(sdPoly(p, DOOR, 5) - ${glsl(SHAPES.door.r)}, 0.0035);
    line = max(line, hair(sdPoly(p, REAR, 4) - ${glsl(SHAPES.rearDoor.r)}, 0.0035));
    float ring = min(min(abs(x + 1.32), abs(x + 2.62)), min(min(abs(x + 3.62), abs(x + 4.62)), abs(x + 5.62)));
    line = max(line, hair(ring, 0.003));
    line = max(line, hair(T - 1.77, 0.003) * step(x, 1.7) * step(-1.3, x));
    line = max(line, hair(x - 2.142, 0.003) * step(0.86, T));
    float rivet = length(vec2(abs(ring - 0.022) , fract(T / 0.045) * 0.045 - 0.0225));
    float dots = (1.0 - smoothstep(0.0035, 0.0055, rivet)) * clamp(0.004 / (fwidth(T) + 0.0001), 0.0, 1.0);
    col *= 1.0 - 0.82 * line;
    col *= 1.0 - 0.3 * dots;
    gRough = max(gRough, dots * 0.3);
    float seal = smoothstep(0.3, 0.85, vEdge);
    col = mix(col, vec3(0.012, 0.012, 0.013), seal);
    gCoat *= 1.0 - seal;
    gRough = max(gRough, seal * 0.75);
    diffuseColor.rgb = col;
  }
  float dust = clamp(smoothstep(1.15, 0.5, vRest.y) * (0.25 + 0.75 * grit) * uDirt, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.25, 0.22, 0.18), dust * 0.6);
  float burn = clamp(uChar * 2.3 - grit * 0.6, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.016, 0.014, 0.013), burn);
  gCoat *= (1.0 - dust * 0.8) * (1.0 - burn);
  gRough = max(gRough, max(dust * 0.7, burn * 0.92));
}
`;
const ROUGH = `roughnessFactor = max(roughnessFactor, gRough);`;
const PHYSICAL = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= gCoat;
  material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.5, 1.0 - gCoat);
#endif
`;

function decalTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 118px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  g.fillText('SP-GZW', 512, 68, 980);
  g.font = 'italic 800 112px "Helvetica Neue", Arial, sans-serif';
  g.fillText('COSTA AIR', 512, 194, 980);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export const TINT = {
  white: [0.8, 0.79, 0.75],
  teal: [0.012, 0.2, 0.22],
  coral: [0.86, 0.25, 0.07],
};

export function createHeliMaterials({ lighting, leatherMaps }) {
  const mats = createCarMaterials({ lighting, leatherMaps, paintColor: 0xffffff });
  const paintUniforms = { tNoise: mats.noise, tDecal: { value: decalTexture() }, uChar: mats.char, uDirt: { value: 0.08 } };
  const paint = mats.register(hookMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.25, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.15, side: THREE.DoubleSide }), {
    key: 'heli-paint', uniforms: paintUniforms, pars: PARS_V, fragPars: PARS_F, vertex: SNIP_V, color: COLOR, rough: ROUGH, physical: PHYSICAL, dynamic: true,
  }));
  return { ...mats, paint, paintUniforms };
}

export function tintGeometry(geometry, tint) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  const col = new Float32Array(n * 3);
  const skin = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    col.set(tint, i * 3);
    skin[i * 2 + 1] = -10;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSkin', new THREE.BufferAttribute(skin, 2));
  g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aRest', new THREE.BufferAttribute(g.attributes.position.array.slice(), 3));
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aSkin', 'aEdge', 'aRest'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.groups = [];
  return g;
}
