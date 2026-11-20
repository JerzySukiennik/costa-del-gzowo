// Riverside water harness: minimal fly camera (drag to look, WASD/QE to move, Shift for speed).
import * as THREE from 'three';

export class FlyCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.dragging = false;
    dom.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointerup', () => (this.dragging = false));
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw -= e.movementX * 0.0035;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0035, -1.5, 1.5);
    });
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  set(position, yaw, pitch) {
    this.camera.position.copy(position);
    this.yaw = yaw;
    this.pitch = pitch;
    this.apply();
  }

  lookAt(position, target) {
    const d = new THREE.Vector3().subVectors(target, position);
    this.set(position, Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
  }

  apply() {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.updateMatrixWorld();
  }

  update(dt) {
    const speed = (this.keys.has('ShiftLeft') ? 25 : 5) * dt;
    const move = new THREE.Vector3(
      (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0),
      (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0),
    );
    if (move.lengthSq() > 0) this.camera.position.addScaledVector(move.applyQuaternion(this.camera.quaternion), speed);
    this.apply();
  }
}
