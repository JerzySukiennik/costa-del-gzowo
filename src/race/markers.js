// Costa del Gzowo: race markers (start beacons with name boards, the gate to reach and the one after it) drawn as additive light, so they add no lamps and cast no shadows.
import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';
import { COURSES, KINDS } from './courses.js';

const TINT = { car: [1.0, 0.6, 0.14], boat: [0.3, 1.15, 1.5], air: [0.8, 0.55, 1.15] };
const FINISH = [1.0, 0.96, 0.88];

function glow() {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
}

function fade(geometry, height, power = 1.6, floor = 0) {
  const p = geometry.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = floor + (1 - floor) * Math.pow(1 - Math.min(1, Math.max(0, p.getY(i) / height)), power);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geometry;
}

function shell(radius, height) {
  return fade(new THREE.CylinderGeometry(radius, radius, height, 48, 6, true).translate(0, height / 2, 0), height);
}

function beam(height) {
  return fade(new THREE.CylinderGeometry(0.22, 0.22, height, 10, 8, true).translate(0, height / 2, 0), height, 1.1);
}

function hoop(radius) {
  const g = new THREE.TorusGeometry(radius, 0.26, 10, 56);
  const c = new Float32Array(g.attributes.position.count * 3).fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function board(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.font = '700 108px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  g.fillText(title.toUpperCase(), 512, 128, 980);
  g.font = '600 52px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  g.globalAlpha = 0.8;
  g.fillText(subtitle.toUpperCase(), 512, 212, 980);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6.4, 1.6, 1);
  return sprite;
}

export function gatePoint(course, gate, out) {
  const y = gate.length > 2 ? gate[2] : course.kind === 'boat' ? 0 : heightAt(gate[0], gate[1]);
  return out.set(gate[0], y, gate[1]);
}

export function createMarkers(ctx) {
  const root = new THREE.Group();
  root.name = 'race-markers';
  ctx.scene.add(root);
  const starts = COURSES.map((course) => {
    const kind = KINDS[course.kind];
    const group = new THREE.Group();
    const y = course.kind === 'boat' ? 0.05 : heightAt(course.start[0], course.start[1]) + 0.05;
    group.position.set(course.start[0], y, course.start[1]);
    const material = glow();
    const ring = new THREE.Mesh(shell(course.kind === 'boat' ? 5 : 3, 1.1), material);
    const pole = new THREE.Mesh(beam(26), material);
    const sign = board(course.name, kind.label);
    sign.position.y = 5.2;
    group.add(ring, pole, sign);
    for (const mesh of [ring, pole]) mesh.frustumCulled = false;
    root.add(group);
    return { course, group, material, sign, tint: new THREE.Color(...TINT[course.kind]) };
  });

  const make = () => {
    const group = new THREE.Group();
    const material = glow();
    const wall = new THREE.Mesh(shell(1, 1), material);
    const pole = new THREE.Mesh(beam(1), material);
    const ring = new THREE.Mesh(hoop(1), material);
    for (const mesh of [wall, pole, ring]) mesh.frustumCulled = false;
    group.add(wall, pole, ring);
    group.visible = false;
    root.add(group);
    return { group, material, wall, pole, ring, tint: new THREE.Color(), level: 1 };
  };
  const gates = [make(), make()];
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  let pulse = 0;

  function place(slot, course, point, before, last, level) {
    const g = gates[slot];
    g.group.visible = !!point;
    if (!point) return;
    const radius = (course.radius || KINDS[course.kind].radius) * 0.62;
    g.group.position.copy(point);
    g.tint.setRGB(...(last ? FINISH : TINT[course.kind]));
    g.level = level;
    const air = course.kind === 'air';
    g.wall.visible = !air;
    g.pole.visible = !air;
    g.ring.visible = air;
    if (air) {
      g.ring.scale.setScalar(radius);
      g.group.lookAt(to.copy(point).multiplyScalar(2).sub(before));
    } else {
      g.group.rotation.set(0, 0, 0);
      g.wall.scale.set(radius, course.kind === 'boat' ? 8 : 5.5, radius);
      g.pole.scale.set(1, 46, 1);
    }
  }

  return {
    root,
    showStarts(on) {
      for (const s of starts) s.group.visible = on;
    },
    setGates(course, sequence, index) {
      if (!course || index >= sequence.length) {
        gates[0].group.visible = gates[1].group.visible = false;
        return;
      }
      const prev = index > 0 ? gatePoint(course, sequence[index - 1], from.clone()) : new THREE.Vector3(course.start[0], 0, course.start[1]);
      const here = gatePoint(course, sequence[index], from.clone());
      if (index === 0 && course.kind === 'air') prev.y = heightAt(prev.x, prev.z);
      place(0, course, here, prev, index === sequence.length - 1, 1);
      const next = index + 1 < sequence.length ? gatePoint(course, sequence[index + 1], to.clone()) : null;
      place(1, course, next, here, index + 1 === sequence.length - 1, 0.32);
    },
    update(dt, night) {
      pulse += dt;
      const day = 1.9 - 1.25 * night;
      const beat = 0.85 + 0.15 * Math.sin(pulse * 3.2);
      for (const s of starts) {
        if (!s.group.visible) continue;
        s.material.color.copy(s.tint).multiplyScalar(day * 0.55 * beat);
        s.sign.material.color.copy(s.tint).multiplyScalar(0.55 + day * 0.5).addScalar(0.25);
      }
      for (const g of gates) if (g.group.visible) g.material.color.copy(g.tint).multiplyScalar(day * g.level * (g.level === 1 ? beat : 1));
    },
  };
}
