// Costa del Gzowo water: half-resolution HDR planar reflection with an oblique near plane and an unjittered mirrored camera.
import * as THREE from 'three';
import { saveState, restoreState } from '../gpu.js';

const normal = new THREE.Vector3(0, 1, 0);
const planePoint = new THREE.Vector3();
const camPos = new THREE.Vector3();
const rotation = new THREE.Matrix4();
const lookAt = new THREE.Vector3();
const target = new THREE.Vector3();
const view = new THREE.Vector3();
const clipPlane = new THREE.Plane();
const clip = new THREE.Vector4();
const q = new THREE.Vector4();
const sphere = new THREE.Sphere();
const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

export class PlanarReflection {
  constructor({ scale = 0.5, layer = 0, waterLevel = 0, clipBias = 0.02, far = 900, minAngularSize = 0.012 }) {
    this.scale = scale;
    this.far = far;
    this.minAngularSize = minAngularSize;
    this.candidates = [];
    this.hidden = [];
    this.scanAge = Infinity;
    this.layer = layer;
    this.waterLevel = waterLevel;
    this.clipBias = clipBias;
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.set(layer);
    this.matrix = new THREE.Matrix4();
    this.target = new THREE.WebGLRenderTarget(16, 16, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
      colorSpace: THREE.NoColorSpace,
    });
    this.texture = this.target.texture;
    this.valid = false;
  }

  setSize(width = this.width, height = this.height) {
    this.width = width;
    this.height = height;
    const w = Math.max(16, Math.round(width * this.scale));
    const h = Math.max(16, Math.round(height * this.scale));
    if (w !== this.target.width || h !== this.target.height) this.target.setSize(w, h);
  }

  render(renderer, scene, camera) {
    planePoint.set(0, this.waterLevel, 0);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(planePoint, camPos);
    if (view.dot(normal) > 0) return false;
    view.reflect(normal).negate().add(planePoint);
    rotation.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rotation).add(camPos);
    target.subVectors(planePoint, lookAt).reflect(normal).negate().add(planePoint);
    const cam = this.camera;
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();

    const near = camera.near;
    const far = Math.min(camera.far, this.far);
    if (camera.isPerspectiveCamera) {
      const top = (near * Math.tan(THREE.MathUtils.DEG2RAD * 0.5 * camera.fov)) / camera.zoom;
      const height = 2 * top;
      const width = camera.aspect * height;
      cam.projectionMatrix.makePerspective(-0.5 * width, 0.5 * width, top, top - height, near, far);
    } else {
      cam.projectionMatrix.copy(camera.projectionMatrix);
    }
    cam.near = near;
    cam.far = far;

    this.matrix.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    clipPlane.setFromNormalAndCoplanarPoint(normal, planePoint.set(0, this.waterLevel - this.clipBias, 0));
    clipPlane.applyMatrix4(cam.matrixWorldInverse);
    clip.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
    const p = cam.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + p[8]) / p[0];
    q.y = (Math.sign(clip.y) + p[9]) / p[5];
    q.z = -1.0;
    q.w = (1.0 + p[10]) / p[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    p[2] = clip.x;
    p[6] = clip.y;
    p[10] = clip.z + 1.0;
    p[14] = clip.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    this.cullSmall(scene, camPos);
    const state = saveState(renderer);
    const shadowNeeds = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.autoClear = true;
    try {
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(scene, cam);
    } finally {
      for (const o of this.hidden) o.visible = true;
      this.hidden.length = 0;
      renderer.shadowMap.needsUpdate = shadowNeeds;
      restoreState(renderer, state);
    }
    this.valid = true;
    return true;
  }

  cullSmall(scene, camPos) {
    if (++this.scanAge > 120) {
      this.scanAge = 0;
      this.candidates.length = 0;
      this.prunable = [];
      const mask = 1 << this.layer;
      const visit = (o) => {
        let relevant = (o.isMesh || o.isPoints || o.isLine || o.isSprite) && (o.layers.mask & mask) !== 0;
        if (o.isLight || o.isCamera) relevant = true;
        const prunedKids = [];
        for (const c of o.children) {
          if (visit(c)) relevant = true;
          else prunedKids.push(c);
        }
        if (relevant) for (const c of prunedKids) this.prunable.push(c);
        if ((o.isMesh || o.isPoints) && !o.isSkinnedMesh && (o.layers.mask & mask) && o.geometry) {
          if (o.isInstancedMesh) {
            if (!o.boundingSphere) o.computeBoundingSphere();
          } else if (!o.geometry.boundingSphere) {
            o.geometry.computeBoundingSphere();
          }
          this.candidates.push(o);
        }
        return relevant;
      };
      visit(scene);
    }
    for (const o of this.prunable) {
      if (o.visible) {
        o.visible = false;
        this.hidden.push(o);
      }
    }
    const k = this.minAngularSize;
    if (k <= 0) return;
    for (const o of this.candidates) {
      if (!o.visible) continue;
      sphere.copy(o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      const d = sphere.center.distanceTo(camPos);
      if (sphere.radius < d * k) {
        o.visible = false;
        this.hidden.push(o);
      }
    }
  }

  dispose() {
    this.target.dispose();
  }
}
