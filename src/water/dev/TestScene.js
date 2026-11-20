// Riverside water harness: stand-in world (terrain from heightAt, bridge deck and piers, bank trees, shallows plants, HDR sky, sun with shadows).
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { BRIDGE, LAYERS, WATER_OBSTACLES, WORLD } from '../../config.js';
import { heightAt, riverCenter, riverHalfWidth } from '../../world/heightfield.js';

const TEX = '../../../assets/textures/';

function loadTex(loader, path, srgb) {
  const t = loader.load(new URL(TEX + path, import.meta.url).href);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function axisSamples(min, max, denseMin, denseMax, coarse, fine) {
  const out = [];
  let v = min;
  while (v < max) {
    out.push(v);
    v += v >= denseMin && v < denseMax ? fine : coarse;
  }
  out.push(max);
  return out;
}

function buildTerrain() {
  const half = WORLD.half;
  const xs = axisSamples(-half, half, -115, 115, 4, 0.6);
  const zs = axisSamples(-half, half, -half, half, 0.8, 0.8);
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  let o = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      pos[o++] = xs[i];
      pos[o++] = heightAt(xs[i], zs[j]);
      pos[o++] = zs[j];
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  o = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      idx[o++] = a;
      idx[o++] = c;
      idx[o++] = b;
      idx[o++] = b;
      idx[o++] = c;
      idx[o++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

function terrainMaterial() {
  const loader = new THREE.TextureLoader();
  const pebble = loadTex(loader, 'ganges_river_pebbles/diff.jpg', true);
  const pebbleN = loadTex(loader, 'ganges_river_pebbles/nor.jpg', false);
  const sand = loadTex(loader, 'coast_sand_01/diff.jpg', true);
  const grass = loadTex(loader, 'leafy_grass/diff.jpg', true);
  const mud = loadTex(loader, 'brown_mud_leaves_01/diff.jpg', true);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tPebble = { value: pebble };
    shader.uniforms.tPebbleN = { value: pebbleN };
    shader.uniforms.tSand = { value: sand };
    shader.uniforms.tGrass = { value: grass };
    shader.uniforms.tMud = { value: mud };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nuniform sampler2D tPebble;\nuniform sampler2D tPebbleN;\nuniform sampler2D tSand;\nuniform sampler2D tGrass;\nuniform sampler2D tMud;')
      .replace('#include <map_fragment>', `
        vec2 wuv = vWorldP.xz;
        float n1 = texture(tGrass, wuv / 61.0).g;
        float hh = vWorldP.y + (n1 - 0.4) * 0.8;
        vec3 cPeb = texture(tPebble, wuv / 2.2).rgb;
        vec3 cPeb2 = texture(tPebble, wuv / 5.3 + 0.37).rgb;
        cPeb = mix(cPeb, cPeb2, 0.35);
        vec3 cSand = texture(tSand, wuv / 3.1).rgb;
        vec3 cMud = texture(tMud, wuv / 3.7).rgb;
        vec3 cGrass = texture(tGrass, wuv / 2.7).rgb;
        float wSand = smoothstep(-1.6, -0.4, hh) * (1.0 - smoothstep(0.6, 1.3, hh));
        float wGrass = smoothstep(0.9, 1.7, hh);
        float wDeep = 1.0 - smoothstep(-2.6, -1.4, hh);
        vec3 bed = mix(cPeb, cSand * 0.95, smoothstep(0.35, 0.7, texture(tGrass, wuv / 13.0).r) * 0.6);
        bed = mix(bed, cMud * 0.8, wDeep * 0.55);
        vec3 c = mix(bed, cSand, wSand);
        c = mix(c, cGrass, wGrass);
        diffuseColor.rgb *= c;
      `);
  };
  return mat;
}

function concrete() {
  const loader = new THREE.TextureLoader();
  const map = loadTex(loader, 'brushed_concrete/diff.jpg', true);
  map.repeat.set(4, 4);
  return new THREE.MeshStandardMaterial({ map, color: 0xd8d4cc, roughness: 0.88 });
}

function addBridge(group) {
  const mat = concrete();
  const deckThickness = 1.3;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.halfLength * 2, deckThickness, BRIDGE.deckHalfWidth * 2), mat);
  deck.position.set(0, BRIDGE.deckY - deckThickness / 2, 0);
  group.add(deck);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8c8f92, roughness: 0.5, metalness: 0.6 });
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.halfLength * 2, 0.9, 0.25), mat);
    rail.position.set(0, BRIDGE.deckY + 0.45, s * (BRIDGE.deckHalfWidth - 0.15));
    group.add(rail);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.halfLength * 2, 0.08, 0.08), railMat);
    bar.position.set(0, BRIDGE.deckY + 1.15, s * (BRIDGE.deckHalfWidth - 0.15));
    group.add(bar);
  }
  for (const x of BRIDGE.pierXs) {
    for (const z of [-BRIDGE.columnZ, BRIDGE.columnZ]) {
      const bottom = heightAt(x, z) - 0.5;
      const top = BRIDGE.deckY - deckThickness - 0.9;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(BRIDGE.columnRadius, BRIDGE.columnRadius, top - bottom, 32), mat);
      col.position.set(x, (top + bottom) / 2, z);
      group.add(col);
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, BRIDGE.columnZ * 2 + 2.4), mat);
    cap.position.set(x, BRIDGE.deckY - deckThickness - 0.45, 0);
    group.add(cap);
  }
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function addTrees(group) {
  const rnd = seeded(42);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.95 });
  const leafMats = [0x2f4a22, 0x3b5a28, 0x29411f, 0x46632e].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const crownGeo = new THREE.IcosahedronGeometry(1, 2);
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 8);
  let placed = 0;
  for (let tries = 0; tries < 2400 && placed < 170; tries++) {
    const z = -220 + rnd() * 440;
    const side = rnd() < 0.5 ? -1 : 1;
    const off = riverHalfWidth(z) + 4 + rnd() * 40;
    const x = riverCenter(z) + side * off;
    if (Math.abs(z) < 9 && Math.abs(x) < 60) continue;
    if (Math.abs(z) < 10) continue;
    const y = heightAt(x, z);
    if (y < 0.9) continue;
    const h = 7 + rnd() * 9;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(1, h * 0.6, 1);
    trunk.position.set(x, y + h * 0.3, z);
    group.add(trunk);
    const n = 3 + Math.floor(rnd() * 3);
    const mat = leafMats[Math.floor(rnd() * leafMats.length)];
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(crownGeo, mat);
      const s = 2.2 + rnd() * 2.6;
      c.scale.set(s, s * (0.8 + rnd() * 0.4), s);
      c.position.set(x + (rnd() - 0.5) * 3.5, y + h * (0.6 + rnd() * 0.35), z + (rnd() - 0.5) * 3.5);
      group.add(c);
    }
    placed++;
  }
  const shed = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x9b4a33, roughness: 0.8 }));
  const sx = riverCenter(40) + riverHalfWidth(40) + 9;
  shed.position.set(sx, heightAt(sx, 40) + 1.6, 40);
  group.add(shed);
}

function addShallows(group) {
  const rnd = seeded(7);
  const weedMat = new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 0.7, side: THREE.DoubleSide });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.95 });
  const blade = new THREE.ConeGeometry(0.05, 1, 3);
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  for (let i = 0; i < 520; i++) {
    const z = -90 + rnd() * 180;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = riverCenter(z) + side * (riverHalfWidth(z) - 1 - rnd() * 12);
    const y = heightAt(x, z);
    if (y > -0.15 || y < -2.4) continue;
    if (rnd() < 0.72) {
      const n = 4 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        const b = new THREE.Mesh(blade, weedMat);
        const h = 0.25 + rnd() * Math.min(0.9, -y * 0.6);
        b.scale.set(1, h, 1);
        b.position.set(x + (rnd() - 0.5) * 0.5, y + h * 0.5, z + (rnd() - 0.5) * 0.5);
        b.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5);
        group.add(b);
      }
    } else {
      const r = new THREE.Mesh(rockGeo, rockMat);
      const s = 0.2 + rnd() * 0.6;
      r.scale.set(s * 1.3, s * 0.6, s);
      r.position.set(x, y + s * 0.15, z);
      r.rotation.y = rnd() * 6;
      group.add(r);
    }
  }
}

function findSun(texture) {
  const { data, width, height } = texture.image;
  let best = -1;
  let bi = 0;
  for (let i = 0; i < width * height; i += 3) {
    const k = i * 4;
    const v = THREE.DataUtils.fromHalfFloat(data[k]) + THREE.DataUtils.fromHalfFloat(data[k + 1]);
    if (v > best) {
      best = v;
      bi = i;
    }
  }
  const px = bi % width;
  const py = Math.floor(bi / width);
  const u = (px + 0.5) / width;
  const v = 1 - (py + 0.5) / height;
  const phi = (u - 0.5) * Math.PI * 2;
  const theta = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)).normalize();
}

export async function buildTestScene(renderer) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const terrain = new THREE.Mesh(buildTerrain(), terrainMaterial());
  terrain.receiveShadow = true;
  terrain.name = 'Terrain';
  group.add(terrain);
  addBridge(group);
  addTrees(group);
  addShallows(group);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o !== terrain;
      o.receiveShadow = true;
      o.layers.set(LAYERS.WORLD);
    }
  });

  const hdr = await new HDRLoader().loadAsync(new URL('../../../assets/hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr', import.meta.url).href);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose();
  const hdrSun = findSun(hdr);
  const sunDirection = hdrSun.y > 0.35 ? hdrSun : new THREE.Vector3(hdrSun.x, 0.0, hdrSun.z).normalize().multiplyScalar(Math.cos(0.75)).setY(Math.sin(0.75)).normalize();
  const sunColor = new THREE.Color(1.0, 0.94, 0.85).multiplyScalar(10);

  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.94, 0.85), 10);
  sun.position.copy(sunDirection).multiplyScalar(220);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -110;
  sc.right = 110;
  sc.top = 110;
  sc.bottom = -110;
  sc.near = 10;
  sc.far = 500;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.layers.enableAll();
  scene.add(sun);
  scene.add(sun.target);

  const waterShadow = buildStaticSunShadow(renderer, scene, sunDirection);
  return { scene, sunDirection, sunColor, sun, waterShadow, hdrSun, obstacles: WATER_OBSTACLES };
}

function buildStaticSunShadow(renderer, scene, sunDirection) {
  const size = 2048;
  const extent = 150;
  const target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
  const cam = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 1, 700);
  cam.position.copy(sunDirection).multiplyScalar(320);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.layers.set(LAYERS.WORLD);
  const bg = scene.background;
  scene.background = null;
  const prev = renderer.getRenderTarget();
  const auto = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.shadowMap.autoUpdate = auto;
  scene.background = bg;
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const matrix = bias.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  return { texture: target.depthTexture, matrix, target };
}
