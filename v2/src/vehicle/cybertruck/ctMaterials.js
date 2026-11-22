// Costa del Gzowo Cyber Truck: materials (anisotropic brushed stainless with per-panel variation, scratches, dust and soot, plus the shared car trim, glass, upholstery and screen materials).
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';
import { createCarMaterials } from '../carMaterials.js';

const STEEL_V = `
attribute vec3 aDmg;
varying vec3 vDmg;
varying float vY;
`;
const STEEL_V_SNIP = `
vDmg = aDmg;
vY = position.y;
`;
const STEEL_F = `
varying vec3 vDmg;
varying float vY;
uniform sampler2D tDamage;
uniform float uDirt;
uniform float uChar;
uniform float uLift;
float gRough;
float gDust;
`;
const STEEL_COLOR = `
{
  vec4 dmg = texture2D(tDamage, vDmg.xy);
  float scratch = smoothstep(0.08, 0.45, dmg.r);
  float dent = smoothstep(0.05, 0.6, dmg.b);
  gDust = clamp(smoothstep(0.82 + uLift, 0.3 + uLift, vY) * uDirt * (0.55 + 0.45 * vDmg.z) + dmg.g * 0.7, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.32 + 0.04, vec3(0.95)), scratch);
  diffuseColor.rgb *= 1.0 - dent * 0.12;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.27, 0.23), gDust * 0.75);
  float burn = clamp(uChar * 1.6 - vDmg.z * 0.4, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.05, 0.045, 0.04), vec3(0.32, 0.2, 0.28), smoothstep(0.2, 0.5, burn) * (1.0 - smoothstep(0.6, 0.95, burn))), burn);
  gRough = scratch * 0.22 + dent * 0.08 + gDust * 0.55 + burn * 0.5 + (vDmg.z - 0.5) * 0.07;
}
`;
const STEEL_NORMAL = `
roughnessFactor = clamp(roughnessFactor + gRough, 0.04, 1.0);
metalnessFactor = 1.0 - gDust * 0.85;
`;

function streakData(n) {
  let seed = 9173;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const rows = new Float32Array(n);
  const phase = [];
  for (let y = 0; y < n; y++) {
    rows[y] = rnd();
    phase.push([rnd() * 6.283, rnd() * 6.283, 1 + Math.floor(rnd() * 3), 4 + Math.floor(rnd() * 6)]);
  }
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const [p1, p2, f1, f2] = phase[y];
    const fine = rows[y] * 0.55 + rows[(y + 1) % n] * 0.25 + rows[(y + n - 1) % n] * 0.2;
    for (let x = 0; x < n; x++) {
      const t = (x / n) * Math.PI * 2;
      const along = 0.5 + 0.3 * Math.sin(t * f1 + p1) + 0.2 * Math.sin(t * f2 + p2);
      h[y * n + x] = fine * 0.75 + along * 0.25 * rows[y];
    }
  }
  return h;
}

function brushTextures() {
  const n = 512;
  const h = streakData(n);
  const rough = new Uint8Array(n * n * 4);
  const nor = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const v = h[i];
      const r = Math.round(255 * (0.62 + 0.3 * v));
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r;
      rough[i * 4 + 3] = 255;
      const dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
      const dx = (h[y * n + ((x + 1) % n)] - h[y * n + ((x + n - 1) % n)]) * 0.15;
      const len = Math.hypot(dx, dy, 1.2);
      nor[i * 4] = Math.round(127.5 + 127.5 * (-dx / len));
      nor[i * 4 + 1] = Math.round(127.5 + 127.5 * (-dy / len));
      nor[i * 4 + 2] = Math.round(127.5 + 127.5 * (1.2 / len));
      nor[i * 4 + 3] = 255;
    }
  }
  const make = (data) => {
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.6, 1.6);
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { roughness: make(rough), normal: make(nor) };
}

export function createTruckMaterials({ lighting, leatherMaps }) {
  const base = createCarMaterials({ lighting, leatherMaps, paintColor: 0x707070 });
  const damageCanvas = document.createElement('canvas');
  damageCanvas.width = damageCanvas.height = 1024;
  const damageCtx = damageCanvas.getContext('2d');
  damageCtx.fillStyle = '#000';
  damageCtx.fillRect(0, 0, 1024, 1024);
  const damageTexture = new THREE.CanvasTexture(damageCanvas);
  damageTexture.colorSpace = THREE.NoColorSpace;
  damageTexture.generateMipmaps = false;
  damageTexture.minFilter = damageTexture.magFilter = THREE.LinearFilter;
  const brush = brushTextures();
  const steelUniforms = { tDamage: { value: damageTexture }, uDirt: { value: 0.12 }, uChar: base.char, uLift: { value: 0 } };
  const steel = base.register(hookMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xa3adb8, vertexColors: true, metalness: 1, roughness: 0.4, roughnessMap: brush.roughness, normalMap: brush.normal, normalScale: new THREE.Vector2(0.22, 0.22),
    anisotropy: 0.22, anisotropyRotation: 0, envMapIntensity: 1.2, side: THREE.DoubleSide,
  }), { key: 'ct-steel', uniforms: steelUniforms, pars: STEEL_V, fragPars: STEEL_F, vertex: STEEL_V_SNIP, color: STEEL_COLOR, normal: STEEL_NORMAL, dynamic: true }));
  return { ...base, steel, steelUniforms, damageCanvas, damageCtx, damageTexture, paintUniforms: steelUniforms };
}

export function glassAttrs(g) {
  const n = g.attributes.position.count;
  g.setAttribute('aRest', new THREE.Float32BufferAttribute(g.attributes.position.array.slice(), 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aProj', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.computeBoundingSphere();
  return g;
}
