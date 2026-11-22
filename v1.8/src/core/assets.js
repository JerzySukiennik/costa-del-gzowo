// Costa del Gzowo: asset loading (PBR texture sets, HDR sky, meshopt GLB models, audio buffers) with progress tracking.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class Assets {
  constructor(renderer) {
    this.renderer = renderer;
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    this.hdrLoader = new HDRLoader();
    this.hdrLoader.setDataType(THREE.FloatType);
    this.cache = new Map();
    this.total = 0;
    this.done = 0;
    this.onProgress = null;
  }

  track(promise) {
    this.total++;
    return promise.then(
      (value) => {
        this.done++;
        if (this.onProgress) this.onProgress(this.done, this.total);
        return value;
      },
      (error) => {
        this.done++;
        throw error;
      },
    );
  }

  once(key, factory) {
    if (!this.cache.has(key)) this.cache.set(key, this.track(factory()));
    return this.cache.get(key);
  }

  texture(path, { srgb = false, repeat = 1, aniso = 8 } = {}) {
    return this.once(`tex:${path}:${srgb}`, async () => {
      const tex = await this.textureLoader.loadAsync(path);
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = Math.min(aniso, this.maxAniso);
      return tex;
    }).then((tex) => {
      if (repeat === 1) return tex;
      const clone = tex.clone();
      clone.repeat.set(repeat, repeat);
      clone.needsUpdate = true;
      return clone;
    });
  }

  async pbr(name, options = {}) {
    const base = `assets/textures/${name}/`;
    const [map, normalMap, arm] = await Promise.all([
      this.texture(base + 'diff.jpg', { ...options, srgb: true }),
      this.texture(base + 'nor.jpg', options),
      this.texture(base + 'arm.jpg', options),
    ]);
    return { map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm };
  }

  image(path) {
    return this.once(`img:${path}`, async () => {
      const response = await fetch(path);
      const blob = await response.blob();
      return createImageBitmap(blob, { colorSpaceConversion: 'none' });
    });
  }

  hdr(path) {
    return this.once(`hdr:${path}`, () => this.hdrLoader.loadAsync(path));
  }

  model(name) {
    return this.once(`glb:${name}`, async () => {
      const gltf = await this.gltfLoader.loadAsync(`assets/models/${name}.glb`);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.transparent || m.alphaTest > 0) {
          m.transparent = false;
          m.alphaTest = 0.42;
          m.depthWrite = true;
          m.side = THREE.DoubleSide;
          m.userData.foliage = true;
        }
        if (m.map) m.map.anisotropy = Math.min(8, this.maxAniso);
      });
      return gltf.scene;
    });
  }

  audio(context, path) {
    return this.once(`snd:${path}`, async () => {
      const response = await fetch(path);
      const data = await response.arrayBuffer();
      return context.decodeAudioData(data);
    });
  }
}
