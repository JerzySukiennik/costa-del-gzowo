// Costa del Gzowo: HDRI sky, sun with cascaded shadows, image-based lighting and the static sun depth map.
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

  let sunDepth = null;
  let tick = 0;
  function buildSunDepth(center, half, size = 4096) {
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 1, 1000);
    cam.position.copy(center).addScaledVector(sunDirection, 500);
    cam.lookAt(center);
    cam.layers.set(LAYERS.WORLD);
    cam.updateMatrixWorld();
    const target = new THREE.WebGLRenderTarget(size, size, { format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true, generateMipmaps: false });
    target.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
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
    csm,
    register,
    registerTree,
    ambientCube,
    buildSunDepth,
    get sunDepth() {
      return sunDepth;
    },
    update() {
      csm.update();
      tick++;
      const far = csm.lights[2].shadow;
      far.autoUpdate = false;
      far.needsUpdate = tick % 3 === 0;
    },
    resize() {
      csm.updateFrustums();
    },
  };
}
