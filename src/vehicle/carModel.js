// Riverside: assembles the convertible (deformable panels, paint and glass shaders, lights, roof mechanism, doors, wheels, interior).
import * as THREE from 'three';
import { buildBody, CAR, MAT } from './carBody.js';
import { buildWheelAssets, buildWheel, buildInterior, buildExterior, plateTexture } from './carParts.js';
import { hookMaterial } from '../render/shaderHooks.js';

const V_PARS = `
attribute float aEdge;
attribute vec3 aRest;
attribute float aProj;
varying float vEdge;
varying vec3 vRest;
flat varying float vProj;
`;
const V_SNIP = `
vEdge = aEdge;
vRest = aRest;
vProj = aProj;
`;
const F_COMMON = `
varying float vEdge;
varying vec3 vRest;
flat varying float vProj;
uniform sampler2D tNoise;
`;

const PAINT_PARS = F_COMMON + `
uniform sampler2D tDamage;
uniform float uDirt;
float gCoat;
float gRough;
`;
const PAINT_COLOR = `
{
  float gap = smoothstep(0.8, 0.94, vEdge);
  vec2 duv;
  if (vProj < 0.5) duv = vec2(vRest.x / 5.0 + 0.5, vRest.y / 1.5) * 0.5;
  else if (vProj < 1.5) duv = vec2(vRest.x / 5.0 + 0.5, vRest.y / 1.5) * 0.5 + vec2(0.5, 0.0);
  else if (vProj < 2.5) duv = vec2(vRest.x / 5.0 + 0.5, vRest.z / 2.0 + 0.5) * 0.5 + vec2(0.0, 0.5);
  else duv = vec2(vRest.z / 2.0 + 0.5, vRest.y / 1.5) * vec2(0.25, 0.5) + vec2(vRest.x > 0.0 ? 0.5 : 0.75, 0.5);
  vec4 dmg = texture2D(tDamage, duv);
  float grit = texture2D(tNoise, vRest.xy * 0.9 + vRest.z * 0.37).r;
  float plastic = max(step(1.95, vRest.x) * step(vRest.y, 0.33), step(vRest.x, -2.15) * step(vRest.y, 0.4));
  plastic = max(plastic, step(vRest.y, 0.2));
  float dust = clamp(smoothstep(0.66, 0.17, vRest.y) * (0.25 + 0.75 * grit) * uDirt + dmg.g, 0.0, 1.0);
  float scratch = smoothstep(0.12, 0.5, dmg.r);
  vec3 bare = mix(vec3(0.3, 0.31, 0.32), vec3(0.62, 0.63, 0.65), smoothstep(0.55, 0.95, dmg.r));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), plastic);
  diffuseColor.rgb = mix(diffuseColor.rgb, bare, scratch * (1.0 - plastic * 0.5));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.235, 0.19), dust * 0.75);
  diffuseColor.rgb *= 1.0 - 0.94 * gap;
  gCoat = (1.0 - plastic) * (1.0 - scratch) * (1.0 - dust * 0.8) * (1.0 - gap);
  gRough = max(plastic * 0.55, max(scratch * 0.5, dust * 0.7));
}
`;
const PAINT_ROUGH = `roughnessFactor = max(roughnessFactor, gRough);`;
const PAINT_PHYSICAL = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= gCoat;
  material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.5, 1.0 - gCoat);
#endif
`;

const LIGHT_PARS = F_COMMON + `
uniform float uBrake;
uniform float uTail;
uniform float uReverse;
uniform float uBeam;
uniform float uDRL;
uniform vec2 uBroken;
float gGlow;
`;
const HEAD_COLOR = `
{
  float alive = 1.0 - (vRest.z < 0.0 ? uBroken.x : uBroken.y);
  float ring = smoothstep(0.42, 0.58, vEdge) * (1.0 - smoothstep(0.78, 0.9, vEdge));
  float d1 = length(vec2(abs(vRest.z) - 0.665, vRest.x - 2.035));
  float d2 = length(vec2(abs(vRest.z) - 0.76, vRest.x - 1.965));
  float lens = max(1.0 - smoothstep(0.03, 0.043, d1), 1.0 - smoothstep(0.026, 0.038, d2));
  float bezel = max(1.0 - smoothstep(0.043, 0.052, d1), 1.0 - smoothstep(0.038, 0.046, d2)) - lens;
  diffuseColor.rgb = mix(vec3(0.03), vec3(0.5), bezel);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.09, 0.1), lens);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2), (1.0 - alive) * 0.7);
  gGlow = alive * (ring * uDRL * 5.5 + lens * uBeam * 55.0 + ring * uBeam * 3.0);
}
`;
const HEAD_EMISSIVE = `totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * gGlow;`;
const TAIL_COLOR = `
{
  float alive = 1.0 - (vRest.z < 0.0 ? uBroken.x : uBroken.y);
  float ring = smoothstep(0.4, 0.56, vEdge) * (1.0 - smoothstep(0.8, 0.92, vEdge));
  float bar = (1.0 - smoothstep(0.012, 0.026, abs(vRest.y - 0.905))) * step(vRest.x, -2.36);
  float seg = 0.6 + 0.4 * step(0.35, fract(abs(vRest.z) * 28.0));
  float rev = step(abs(vRest.z), 0.2) * step(vRest.x, -2.36) * (1.0 - smoothstep(0.02, 0.04, abs(vRest.y - 0.875)));
  diffuseColor.rgb = mix(vec3(0.16, 0.006, 0.008), vec3(0.2), (1.0 - alive) * 0.7);
  gGlow = alive * (ring * (uTail * 1.4 + uBrake * 9.0) + bar * seg * (uTail * 2.2 + uBrake * 16.0));
  gGlow += 1000.0 * floor(alive * rev * uReverse + 0.5);
}
`;
const TAIL_EMISSIVE = `
{
  float white = floor(gGlow / 1000.0);
  float red = gGlow - white * 1000.0;
  totalEmissiveRadiance += vec3(1.0, 0.045, 0.02) * red + vec3(1.0, 0.98, 0.95) * white * 9.0;
}
`;

const GLASS_PARS = F_COMMON + `
uniform float uCrack;
uniform float uBase;
`;
const GLASS_FINAL = `
{
  float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.6, 0.1));
  float a = clamp(uBase + lum * 0.42, 0.0, 0.96);
  if (uCrack > 0.0) {
    vec2 p = vRest.xy * 7.0 + vRest.z * 5.3;
    float n1 = texture2D(tNoise, p * 0.11).r;
    float n2 = texture2D(tNoise, p * 0.47 + 0.3).g;
    float web = smoothstep(0.035, 0.0, abs(n1 - 0.5)) + smoothstep(0.03, 0.0, abs(n2 - 0.5)) * 0.8;
    web *= uCrack;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.6, 1.7, 1.75), clamp(web, 0.0, 1.0) * 0.8);
    a = clamp(a + web * 0.8 + uCrack * 0.2, 0.0, 1.0);
  }
  gl_FragColor.a = a;
}
`;

function grilleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#060606';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#262626';
  g.lineWidth = 3;
  const r = 13;
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 26; col++) {
      const cx = col * r * 1.74 + (row % 2 ? r * 0.87 : 0);
      const cy = row * r * 1.5;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (k) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export async function createCarModel(ctx) {
  const { assets, lighting, terrain } = ctx;
  const leatherMaps = await assets.pbr('fabric_leather_01', { repeat: 3 });
  const body = buildBody();
  const group = new THREE.Group();
  group.name = 'car';

  const damageCanvas = document.createElement('canvas');
  damageCanvas.width = damageCanvas.height = 1024;
  const damageCtx = damageCanvas.getContext('2d');
  damageCtx.fillStyle = '#000';
  damageCtx.fillRect(0, 0, 1024, 1024);
  const damageTexture = new THREE.CanvasTexture(damageCanvas);
  damageTexture.colorSpace = THREE.NoColorSpace;
  damageTexture.generateMipmaps = false;
  damageTexture.minFilter = damageTexture.magFilter = THREE.LinearFilter;

  const noise = { value: terrain.noise };
  const paintUniforms = { tNoise: noise, tDamage: { value: damageTexture }, uDirt: { value: 0.3 } };
  const lightUniforms = {
    tNoise: noise, uBrake: { value: 0 }, uTail: { value: 1 }, uReverse: { value: 0 }, uBeam: { value: 0 }, uDRL: { value: 1 },
  };
  const headBroken = { value: new THREE.Vector2(0, 0) };
  const tailBroken = { value: new THREE.Vector2(0, 0) };

  const paint = hookMaterial(new THREE.MeshPhysicalMaterial({ color: 0xc2410c, metalness: 0.62, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.35, side: THREE.DoubleSide }), {
    key: 'car-paint', uniforms: paintUniforms, pars: V_PARS, fragPars: PAINT_PARS, vertex: V_SNIP, color: PAINT_COLOR, rough: PAINT_ROUGH, physical: PAINT_PHYSICAL, dynamic: true,
  });
  const trim = hookMaterial(new THREE.MeshPhysicalMaterial({ color: 0x040405, metalness: 0, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }), { key: 'car-trim', dynamic: true });
  const head = hookMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 }), {
    key: 'car-head', uniforms: { ...lightUniforms, uBroken: headBroken }, pars: V_PARS, fragPars: LIGHT_PARS, vertex: V_SNIP, color: HEAD_COLOR, emissive: HEAD_EMISSIVE, dynamic: true,
  });
  const tail = hookMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.02 }), {
    key: 'car-tail', uniforms: { ...lightUniforms, uBroken: tailBroken }, pars: V_PARS, fragPars: LIGHT_PARS, vertex: V_SNIP, color: TAIL_COLOR, emissive: TAIL_EMISSIVE, dynamic: true,
  });
  const grille = hookMaterial(new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.55, metalness: 0.3 }), { key: 'car-grille', dynamic: true });
  const glassMaterials = {};
  const makeGlass = (name, base = 0.26) => {
    const uniforms = { tNoise: noise, uCrack: { value: 0 }, uBase: { value: base } };
    const m = hookMaterial(new THREE.MeshPhysicalMaterial({ color: 0x0b1215, metalness: 0, roughness: 0.03, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }), {
      key: 'car-glass', uniforms, pars: V_PARS, fragPars: GLASS_PARS, vertex: V_SNIP, final: GLASS_FINAL,
    });
    m.userData.uniforms = uniforms;
    lighting.register(m);
    glassMaterials[name] = m;
    return m;
  };
  [paint, trim, head, tail, grille].forEach((m) => lighting.register(m));

  const dyn = (m, key = 'car-part') => {
    hookMaterial(m, { key, dynamic: true });
    lighting.register(m);
    return m;
  };

  const panels = {};
  const pivots = {};
  const addPanel = (name, geometry, parent, glassName) => {
    const mesh = new THREE.Mesh(geometry, [paint, makeGlass(glassName || name), trim, head, tail, grille]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.name = name;
    parent.add(mesh);
    panels[name] = mesh;
    return mesh;
  };
  const pivotAt = (name, x, y, z) => {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.name = name;
    group.add(p);
    pivots[name] = p;
    return p;
  };
  const under = (pivot, mesh) => {
    mesh.position.copy(pivot.position).negate();
    pivot.add(mesh);
    return mesh;
  };

  addPanel('shell', body.panels.shell, group, 'windshield');
  for (const name of ['frontBumper', 'rearBumper']) {
    const p = pivotAt(name, name === 'frontBumper' ? 2.1 : -2.25, 0.45, 0);
    under(p, addPanel(name, body.panels[name], p));
    const cap = new THREE.Mesh(body.caps[name], [paint, paint, trim, head, tail, grille]);
    cap.castShadow = true;
    under(p, cap);
    panels[name + 'Cap'] = cap;
  }
  const hoodPivot = pivotAt('hood', 1.02, 0.97, 0);
  under(hoodPivot, addPanel('hood', body.panels.hood, hoodPivot));
  const trunkPivot = pivotAt('trunk', -2.365, 1.035, 0);
  under(trunkPivot, addPanel('trunk', body.panels.trunk, trunkPivot));
  const roofPivot = pivotAt('roof', -1.74, 1.06, 0);
  under(roofPivot, addPanel('roof', body.panels.roof, roofPivot, 'rearGlass'));

  const interior = buildInterior({ leatherMaps });
  Object.values(interior.materials).forEach((m) => dyn(m, 'car-interior'));
  group.add(interior.group);
  interior.group.traverse((o) => {
    if (o.isMesh && o.material.isMeshBasicMaterial) o.material.userData.screen = true;
  });

  const windows = {};
  for (const tag of ['L', 'R']) {
    const s = tag === 'L' ? -1 : 1;
    for (const [door, win, hx] of [['doorF', 'winF', 0.98], ['doorR', 'winR', -0.28]]) {
      const p = pivotAt(door + tag, hx, 0.55, s * 0.9);
      under(p, addPanel(door + tag, body.panels[door + tag], p));
      const w = under(p, addPanel(win + tag, body.panels[win + tag], p, win + tag));
      w.userData.baseY = w.position.y;
      windows[win + tag] = w;
      const card = interior.doorCards[door + tag];
      card.position.copy(p.position).negate();
      p.add(card);
    }
  }

  const mirrorMat = dyn(new THREE.MeshStandardMaterial({ color: 0xdfe6ea, metalness: 1, roughness: 0.03 }), 'car-mirror');
  const plastic = dyn(new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.7, metalness: 0 }));
  const chrome = dyn(new THREE.MeshStandardMaterial({ color: 0x8d9094, roughness: 0.16, metalness: 1 }));
  const liner = dyn(new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  const exterior = buildExterior({ paint: dyn(new THREE.MeshPhysicalMaterial({ color: 0xc64a12, metalness: 0.5, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.035 }), 'car-paint-plain'), trim, mirror: mirrorMat, plastic, chrome, liner });
  exterior.mirrors.forEach((m, i) => {
    const p = pivots['doorF' + (i === 0 ? 'L' : 'R')];
    m.position.sub(p.position);
    p.add(m);
  });
  for (const h of exterior.handles) {
    const p = pivots[h.door];
    h.mesh.position.sub(p.position);
    p.add(h.mesh);
  }
  under(pivots.rearBumper, exterior.exhaust);
  group.add(exterior.blackTrim, exterior.wipers, exterior.liners);

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.155), dyn(new THREE.MeshStandardMaterial({ map: plateTexture('RVR 26'), roughness: 0.45, metalness: 0.1 }), 'car-plate'));
  plate.rotation.y = -Math.PI / 2;
  pivots.rearBumper.add(plate);
  plate.position.set(-2.458 - pivots.rearBumper.position.x, 0.52 - pivots.rearBumper.position.y, 0);

  const stopMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.01, 0.01), toneMapped: false });
  const stop = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.46), stopMat);
  stop.position.set(-2.352 - trunkPivot.position.x, 1.047 - trunkPivot.position.y, 0);
  trunkPivot.add(stop);

  const wheelAssets = buildWheelAssets();
  Object.values(wheelAssets.materials).forEach((m) => dyn(m, 'car-wheel'));
  const wheels = [];
  for (const [front, ax] of [[true, CAR.axleFront], [false, CAR.axleRear]]) {
    for (const s of [-1, 1]) {
      const w = buildWheel(wheelAssets, s);
      w.group.position.set(ax, CAR.wheelRadius, s * (CAR.track / 2));
      group.add(w.group);
      wheels.push({ ...w, side: s, front, x: ax, z: s * (CAR.track / 2), angle: 0 });
    }
  }

  const beams = [-1, 1].map((s) => {
    const light = new THREE.SpotLight(0xfff4e0, 0, 70, 0.52, 0.7, 1.6);
    light.position.set(2.12, 0.68, s * 0.66);
    light.target.position.set(22, 0.1, s * 1.2);
    group.add(light, light.target);
    return light;
  });

  const roof = { value: 1, target: 1 };
  const doorState = { doorFL: { value: 0, target: 0 }, doorFR: { value: 0, target: 0 } };
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  function applyRoof() {
    const r = roof.value;
    trunkPivot.rotation.z = Math.sin(Math.PI * Math.min(1, Math.max(0, (r - 0.04) / 0.92))) * 0.95;
    roofPivot.rotation.z = smooth(0.1, 0.82, r) * 2.78;
    roofPivot.position.y = 1.06 - smooth(0.55, 1, r) * 0.42;
    roofPivot.scale.setScalar(1 - smooth(0.6, 1, r) * 0.32);
    roofPivot.visible = r < 0.995;
    const drop = smooth(0, 0.22, r);
    for (const w of Object.values(windows)) {
      w.position.y = w.userData.baseY - drop * 0.5;
      w.visible = drop < 0.98 && !w.userData.broken;
    }
  }
  applyRoof();

  const casters = new Set([...Object.values(panels)]);
  for (const w of wheels) casters.add(w.spin.children[0]);
  interior.group.traverse((o) => {
    if (o.isMesh && o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere();
    if (o.isMesh && o.geometry.boundingSphere.radius > 0.34) casters.add(o);
  });
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = casters.has(o);
  });

  return {
    group, panels, pivots, wheels, interior, windows, glassMaterials, damageCanvas, damageCtx, damageTexture, paintUniforms, body,
    materials: { paint, trim, head, tail, grille, plastic, chrome },
    steeringWheel: interior.steeringWheel,
    mirrors: exterior.mirrors,
    seat: interior.seat,
    headBroken: headBroken.value,
    tailBroken: tailBroken.value,
    roof,
    toggleRoof() {
      roof.target = roof.target > 0.5 ? 0 : 1;
    },
    setDoor(name, open) {
      if (doorState[name]) doorState[name].target = open ? 1 : 0;
    },
    setLights({ brake, reverse, beam }) {
      lightUniforms.uBrake.value = brake;
      lightUniforms.uReverse.value = reverse ? 1 : 0;
      lightUniforms.uBeam.value = beam ? 1 : 0;
      stopMat.color.setRGB(0.25 + brake * 14, 0.01 + brake * 0.5, 0.01 + brake * 0.25);
      const on = beam ? 1 : 0;
      beams[0].intensity = on * 260 * (1 - headBroken.value.x);
      beams[1].intensity = on * 260 * (1 - headBroken.value.y);
    },
    update(dt) {
      if (roof.value !== roof.target) {
        roof.value += Math.sign(roof.target - roof.value) * Math.min(Math.abs(roof.target - roof.value), dt / 3.2);
        applyRoof();
      }
      for (const [name, d] of Object.entries(doorState)) {
        if (d.value === d.target) continue;
        d.value += Math.sign(d.target - d.value) * Math.min(Math.abs(d.target - d.value), dt / 0.45);
        const e = d.value * d.value * (3 - 2 * d.value);
        pivots[name].rotation.y = (name.endsWith('L') ? -1 : 1) * e * 1.05;
      }
    },
  };
}
