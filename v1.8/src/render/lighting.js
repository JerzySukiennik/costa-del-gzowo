// Costa del Gzowo: HDRI sky, sun with cascaded shadows (casters may switch to lighter shapes while the maps are drawn), image-based lighting, the static sun depth map, and the fade from golden hour through sunset to a moonlit night with stars.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { LAYERS } from '../config.js';

const SKY_FILE = 'assets/hdri/wasteland_clouds_puresky_4k.hdr';
const HDRI_SUN = new THREE.Vector3(0.802, 0.135, 0.582);
const WORLD_SUN = new THREE.Vector3(0.3, 0.232, 0.954).normalize();
const SUN_TINT = new THREE.Color(1.0, 0.66, 0.36);
const SUN_INTENSITY = 10;
const SKY_SCALE = 0.42;

const ENV_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ENV_FRAG = `
uniform sampler2D tSky;
uniform float uRot;
uniform float uMax;
uniform float uScale;
uniform vec3 uGround;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float c = cos(uRot);
  float s = sin(uRot);
  vec3 t = vec3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
  vec2 uv = vec2(atan(t.z, t.x) * 0.15915494 + 0.5, asin(clamp(t.y, -1.0, 1.0)) * 0.31830989 + 0.5);
  vec3 sky = min(texture2D(tSky, uv).rgb * uScale, vec3(uMax));
  sky = mix(sky, uGround, smoothstep(0.03, -0.14, d.y));
  gl_FragColor = vec4(sky, 1.0);
}`;

export async function createLighting({ renderer, scene, camera, assets }) {
  const sky = await assets.hdr(SKY_FILE);
  const data = sky.image.data;
  for (let i = 0; i < data.length; i++) if (data[i] > 420) data[i] = 420;
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.minFilter = sky.magFilter = THREE.LinearFilter;
  sky.needsUpdate = true;

  const rotation = Math.atan2(HDRI_SUN.z, HDRI_SUN.x) - Math.atan2(WORLD_SUN.z, WORLD_SUN.x);
  scene.background = sky;
  scene.backgroundRotation.set(0, rotation, 0);
  scene.backgroundIntensity = SKY_SCALE;

  const envScene = new THREE.Scene();
  const envMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: ENV_VERT,
    fragmentShader: ENV_FRAG,
    uniforms: { tSky: { value: sky }, uRot: { value: rotation }, uMax: { value: 9 }, uScale: { value: SKY_SCALE }, uGround: { value: new THREE.Color(0.2, 0.19, 0.12) } },
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), envMaterial));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(envScene, 0, 0.1, 200);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.82;
  pmrem.dispose();

  const sunDirection = WORLD_SUN.clone();
  const sunColor = SUN_TINT.clone().multiplyScalar(SUN_INTENSITY);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const csm = new CSM({
    camera,
    parent: scene,
    cascades: 3,
    maxFar: 240,
    mode: 'custom',
    customSplitsCallback: (cascades, near, far, breaks) => {
      breaks.push(0.055, 0.22, 1);
    },
    shadowMapSize: 2048,
    shadowBias: -0.0002,
    lightDirection: sunDirection.clone().negate(),
    lightIntensity: SUN_INTENSITY,
    lightNear: 1,
    lightFar: 900,
    lightMargin: 260,
  });
  csm.lights.forEach((light, i) => {
    light.color.copy(SUN_TINT);
    light.shadow.normalBias = [0.014, 0.045, 0.16][i];
  });

  const registered = new WeakSet();
  function register(material) {
    if (!material || registered.has(material) || !(material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial)) return;
    registered.add(material);
    const own = material.onBeforeCompile;
    const hasOwn = material.userData.customShader === true;
    csm.setupMaterial(material);
    const csmHook = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, r) {
      csmHook(shader);
      if (hasOwn) own.call(material, shader, r);
    };
    material.needsUpdate = true;
  }
  function registerTree(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material)) o.material.forEach(register);
      else register(o.material);
    });
  }

  let ambient = null;
  function ambientCube() {
    if (ambient) return ambient;
    const { width, height } = sky.image;
    const ground = envMaterial.uniforms.uGround.value.toArray();
    const limit = envMaterial.uniforms.uMax.value;
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const W = 256;
    const H = 128;
    const sum = Array.from({ length: 6 }, () => [0, 0, 0]);
    for (let j = 0; j < H; j++) {
      const theta = ((j + 0.5) / H) * Math.PI;
      const y = Math.cos(theta);
      const ring = Math.sin(theta);
      const weight = ring * (Math.PI / H) * ((2 * Math.PI) / W);
      const mixGround = THREE.MathUtils.smoothstep(-y, -0.03, 0.14);
      for (let i = 0; i < W; i++) {
        const phi = ((i + 0.5) / W) * Math.PI * 2;
        const x = ring * Math.cos(phi);
        const z = ring * Math.sin(phi);
        const tx = x * c - z * s;
        const tz = x * s + z * c;
        const u = Math.atan2(tz, tx) * 0.15915494 + 0.5;
        const v = Math.asin(y) * 0.31830989 + 0.5;
        const px = Math.min(width - 1, Math.floor(u * width));
        const py = Math.min(height - 1, Math.floor((1 - v) * height));
        const o = (py * width + px) * 4;
        const facing = [Math.max(x, 0), Math.max(-x, 0), Math.max(y, 0), Math.max(-y, 0), Math.max(z, 0), Math.max(-z, 0)];
        for (let k = 0; k < 3; k++) {
          const radiance = THREE.MathUtils.lerp(Math.min(data[o + k] * SKY_SCALE, limit), ground[k], mixGround);
          for (let f = 0; f < 6; f++) sum[f][k] += radiance * facing[f] * weight;
        }
      }
    }
    ambient = sum.map((v) => new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(scene.environmentIntensity / Math.PI));
    return ambient;
  }

  const golden = SUN_TINT.clone();
  const ember = new THREE.Color(1.0, 0.34, 0.12);
  const moon = new THREE.Color(0.46, 0.62, 1.0);
  const tint = SUN_TINT.clone();
  const fogSky = new THREE.Color(0.19, 0.2, 0.24);
  const grassSky = new THREE.Color(0.34, 0.45, 0.54);
  const dayTint = new THREE.Color(1, 1, 1);
  const ramp = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  let night = 0;
  let ambientScale = 1;

  const starCount = 1900;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  let seed = 20261122;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < starCount; i++) {
    const y = 0.03 + 0.97 * random();
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    starPositions.set([Math.cos(a) * r * 3200, y * 3200, Math.sin(a) * r * 3200], i * 3);
    const b = 0.25 + 2.6 * Math.pow(random(), 5) + 0.5 * random();
    const warm = random();
    starColors.set([b * (0.85 + 0.3 * warm), b, b * (1.15 - 0.3 * warm)], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  starGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3300);
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  stars.frustumCulled = false;
  stars.visible = false;
  stars.name = 'stars';
  scene.add(stars);

  function setNight(value) {
    const n = Math.min(1, Math.max(0, value));
    if (Math.abs(n - night) < 0.0015 && n !== 0 && n !== 1) return;
    night = n;
    const toEmber = ramp(0, 0.55, n);
    const toMoon = ramp(0.45, 0.9, n);
    const dark = ramp(0.1, 0.9, n);
    tint.copy(golden).lerp(ember, toEmber).lerp(moon, toMoon);
    const strength = THREE.MathUtils.lerp(1 - 0.72 * toEmber, 0.055, toMoon);
    sunColor.copy(tint).multiplyScalar(SUN_INTENSITY * strength);
    for (const light of csm.lights) {
      light.color.copy(tint);
      light.intensity = SUN_INTENSITY * strength;
    }
    scene.backgroundIntensity = SKY_SCALE * THREE.MathUtils.lerp(1, 0.03, dark);
    ambientScale = THREE.MathUtils.lerp(1, 0.1, dark);
    scene.environmentIntensity = 0.82 * ambientScale;
    const sky = THREE.MathUtils.lerp(1, 0.07, dark);
    fogSky.setRGB(0.19 * sky * (1 - 0.25 * dark), 0.2 * sky * (1 - 0.1 * dark), 0.24 * sky * (1 + 0.35 * dark));
    grassSky.setRGB(0.34 * sky * (1 - 0.25 * dark), 0.45 * sky * (1 - 0.1 * dark), 0.54 * sky * (1 + 0.35 * dark));
    dayTint.setRGB((0.72 * strength * tint.r) / golden.r + 0.28 * sky, (0.72 * strength * tint.g) / golden.g + 0.28 * sky, (0.72 * strength * tint.b) / golden.b + 0.28 * sky * (1 + 0.3 * dark));
    stars.visible = n > 0.3;
    stars.material.opacity = ramp(0.35, 0.95, n);
  }

  let sunDepth = null;
  let tick = 0;
  let farEvery = 3;
  let stage = null;
  const single = [null];
  const shadowMap = renderer.shadowMap;
  const drawShadows = shadowMap.render;
  shadowMap.render = function (lights, target, view) {
    const active = stage && target === scene && this.enabled !== false && (this.autoUpdate !== false || this.needsUpdate !== false) && lights.length > 0;
    if (!active) return drawShadows.call(this, lights, target, view);
    for (const light of lights) {
      const shadow = light.shadow;
      if (!shadow || (shadow.autoUpdate === false && shadow.needsUpdate === false)) continue;
      single[0] = light;
      stage('shadow', true, light);
      this.needsUpdate = true;
      try {
        drawShadows.call(this, single, target, view);
      } finally {
        stage('shadow', false, light);
      }
    }
    this.needsUpdate = false;
  };
  function buildSunDepth(center, half, size = 4096, cover = []) {
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 1, 1000);
    cam.position.copy(center).addScaledVector(sunDirection, 500);
    cam.lookAt(center);
    cam.layers.set(LAYERS.WORLD);
    cam.updateMatrixWorld();
    const local = new THREE.Vector3();
    for (const p of cover) {
      local.copy(p).applyMatrix4(cam.matrixWorldInverse);
      cam.left = Math.min(cam.left, Math.floor(local.x));
      cam.right = Math.max(cam.right, Math.ceil(local.x));
    }
    cam.updateProjectionMatrix();
    const width = Math.round((size * (cam.right - cam.left)) / (2 * half));
    const target = new THREE.WebGLRenderTarget(width, size, { format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true, generateMipmaps: false });
    target.depthTexture = new THREE.DepthTexture(width, size, THREE.UnsignedIntType);
    target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
    const background = scene.background;
    const environment = scene.environment;
    scene.background = null;
    scene.environment = null;
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.shadowMap.autoUpdate = auto;
    scene.background = background;
    scene.environment = environment;
    const matrix = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    sunDepth = { texture: target.depthTexture, matrix, target };
    return sunDepth;
  }

  return {
    sky,
    rotation,
    sunDirection,
    sunColor,
    sunTint: SUN_TINT,
    sunIntensity: SUN_INTENSITY,
    csm,
    register,
    registerTree,
    ambientCube,
    buildSunDepth,
    get sunDepth() {
      return sunDepth;
    },
    fogSky,
    grassSky,
    dayTint,
    setNight,
    get night() {
      return night;
    },
    get ambientScale() {
      return ambientScale;
    },
    update() {
      stars.position.copy(camera.position);
      csm.update();
      tick++;
      const far = csm.lights[2].shadow;
      far.autoUpdate = false;
      far.needsUpdate = tick % farEvery === 0;
    },
    setStage(fn) {
      stage = fn;
    },
    setShadows({ size, every, far }) {
      if (every) farEvery = every;
      if (far && csm.maxFar !== far) {
        csm.maxFar = far;
        csm.updateFrustums();
      }
      if (!size) return;
      csm.shadowMapSize = size;
      for (const light of csm.lights) {
        if (light.shadow.mapSize.x === size) continue;
        light.shadow.mapSize.set(size, size);
        if (light.shadow.map) light.shadow.map.dispose();
        light.shadow.map = null;
        light.shadow.needsUpdate = true;
      }
      tick = 0;
    },
    resize() {
      csm.updateFrustums();
    },
  };
}
