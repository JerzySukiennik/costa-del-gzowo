// Costa del Gzowo Roadster: the Roadster Jump car (GLB with gull doors, targa, ten gimballed cold-gas nozzles) merged for few draw calls, with vapour-jet plumes, jet light, lamps and the shared car-model API.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hookMaterial } from '../../render/shaderHooks.js';
import { carHull } from './roadsterSim.js';
import { TUNING } from './tuning.js';

export const NOZZLES = ['RL1', 'RL2', 'RR2', 'RR1', 'FL', 'FR', 'SL1', 'SL2', 'SR1', 'SR2'];
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
const DRIVEN = /^(Wheel_|Steer_|Brake_|SteeringWheel$|Nozzle_|Exhaust_Nozzle_|Pod_Nozzle_|Door_|Roof_Targa$|Flap_F$|NozzleMount_|Wing$)/;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const JET_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const JET_FS = `uniform sampler2D uTex; uniform float uFrame, uA, uL; varying vec2 vUv;
void main(){ float f = floor(mod(uFrame, 64.0)); vec2 cell = vec2(mod(f, 8.0), floor(f / 8.0)); vec2 uv = vec2((cell.x + vUv.x) / 8.0, 1.0 - (cell.y + 1.0 - vUv.y) / 8.0);
  vec4 t = texture2D(uTex, uv); float a = t.a * uA; if (a < 0.003) discard;
  vec3 c = t.rgb * vec3(0.78, 0.9, 1.15) * uL * (1.0 + 1.6 * pow(1.0 - vUv.x, 6.0));
  gl_FragColor = vec4(c, a); }`;

function preserveAlpha(m) {
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}

function mergeUnder(node, meshes) {
  const groups = new Map();
  node.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  for (const m of meshes) {
    if (Array.isArray(m.material)) continue;
    const k = m.material.uuid;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  for (const list of groups.values()) {
    if (list.length < 2 && list[0].parent === node) continue;
    const geos = [];
    const keep = { position: 3, normal: 3, uv: 2, uv1: 2, tangent: 4 };
    const present = new Set();
    for (const m of list) for (const k of Object.keys(m.geometry.attributes)) if (keep[k]) present.add(k);
    const get = ['getX', 'getY', 'getZ', 'getW'];
    for (const m of list) {
      m.updateWorldMatrix(true, false);
      const src = m.geometry;
      const g = new THREE.BufferGeometry();
      for (const k of present) {
        const size = keep[k];
        const a = src.attributes[k];
        const count = src.attributes.position.count;
        const arr = new Float32Array(count * size);
        if (a) for (let i = 0; i < count; i++) for (let j = 0; j < size; j++) arr[i * size + j] = j < a.itemSize ? a[get[j]](i) : 1;
        g.setAttribute(k, new THREE.BufferAttribute(arr, size));
      }
      g.setIndex(src.index ? Array.from(src.index.array) : [...Array(src.attributes.position.count).keys()]);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (!src.attributes.normal) g.computeVertexNormals();
      geos.push(g);
    }
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.name = node.name + '_' + (list[0].material.name || 'mat');
    mesh.receiveShadow = true;
    node.add(mesh);
    for (const m of list) {
      m.geometry = new THREE.BufferGeometry();
      m.visible = false;
    }
  }
}

export async function createRoadsterModel(ctx) {
  const base = ctx.base || '';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, jetTex] = await Promise.all([loader.loadAsync(base + 'assets/vehicles/roadster/roadster.glb'), new THREE.TextureLoader().loadAsync(base + 'assets/vehicles/roadster/vapour_jet.webp')]);
  jetTex.colorSpace = THREE.SRGBColorSpace;
  const root = gltf.scene;
  const n = {};
  root.traverse((o) => {
    if (o.name && !n[o.name]) n[o.name] = o;
  });
  if (n.Wing) n.Wing.visible = false;
  const car = n.Roadster || root;
  if (n.Nozzle_FL && n.Nozzle_FR && n.Nozzle_FL.parent === n.Nozzle_FR.parent && n.Nozzle_FL.position.length() > 1) n.Nozzle_FL.position.set(-n.Nozzle_FR.position.x, n.Nozzle_FR.position.y, n.Nozzle_FR.position.z);

  const mats = {};
  root.traverse((o) => {
    if (o.isMesh) for (const m of [].concat(o.material)) mats[m.name] = m;
  });
  const glassMaterials = {};
  for (const m of Object.values(mats)) {
    if (m.isMeshPhysicalMaterial && m.name !== 'Paint') {
      m.clearcoat = 0;
    }
    if (m.transmission > 0 || m.name === 'Glass_Tint' || m.name === 'Lens' || m.name === 'Lens_Tail') {
      const t = m.transmission || 0.6;
      m.transmission = 0;
      m.thickness = 0;
      m.transparent = true;
      m.opacity = Math.max(0.35, 1 - t * 0.55);
      m.depthWrite = false;
      preserveAlpha(m);
      glassMaterials[m.name] = m;
      m.userData.uniforms = { uCrack: { value: 0 } };
    }
    hookMaterial(m, { key: 'roadster-' + (m.transparent ? 'glass' : 'solid'), dynamic: !m.transparent });
    if (ctx.lighting && ctx.lighting.register) ctx.lighting.register(m);
    m.needsUpdate = true;
  }

  root.updateMatrixWorld(true);
  const dynamic = new Set();
  root.traverse((o) => {
    if (DRIVEN.test(o.name)) dynamic.add(o);
  });
  for (const clip of gltf.animations) for (const tr of clip.tracks) {
    const node = n[tr.name.slice(0, tr.name.lastIndexOf('.'))];
    if (node) dynamic.add(node);
  }
  const owner = (o) => {
    for (let p = o.parent; p; p = p.parent) if (dynamic.has(p)) return p;
    return car;
  };
  const remap = (o, allowed, fallback) => {
    o.traverse((m) => {
      if (!m.isMesh || Array.isArray(m.material)) return;
      const name = m.material.name;
      if (!allowed.includes(name)) m.material = mats[fallback(name)] || m.material;
    });
  };
  for (const id of WHEELS) if (n['Wheel_' + id]) remap(n['Wheel_' + id], ['Tire', 'Rim', 'Brake_Disc'], (name) => (name === 'Rubber' ? 'Tire' : 'Rim'));
  for (const id of ['L', 'R']) if (n['Door_' + id]) remap(n['Door_' + id], ['Paint', 'Glass_Tint', 'Interior_Dark', 'Paint_Black'], (name) => (/Leather|Alcantara/.test(name) ? 'Interior_Dark' : 'Paint_Black'));
  const buckets = new Map();
  car.traverse((o) => {
    if (!o.isMesh) return;
    const k = dynamic.has(o) ? o : owner(o);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  });
  for (const [node, list] of buckets) mergeUnder(node, list.filter((m) => m !== node));
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });

  const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const hull = carHull(TUNING);
  const pts = [];
  for (const arr of [hull.body, hull.cabin]) for (let i = 0; i < arr.length; i += 3) pts.push(new THREE.Vector3(arr[i] * 0.88, 0.2 + (arr[i + 1] - 0.2) * 0.9, arr[i + 2] * 0.96));
  const proxyGeos = [new ConvexGeometry(pts)];
  for (const id of WHEELS) {
    const s = n['Steer_' + id] || n['Wheel_' + id];
    if (!s) continue;
    const r = id[0] === 'F' ? TUNING.wheels.radius_front : TUNING.wheels.radius_rear;
    proxyGeos.push(new THREE.CylinderGeometry(r, r, 0.28, 14).rotateZ(Math.PI / 2).translate(s.position.x, s.position.y, s.position.z));
  }
  const proxy = new THREE.Mesh(mergeGeometries(proxyGeos.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    return g;
  })), proxyMat);
  proxy.castShadow = true;
  proxy.receiveShadow = false;
  proxy.frustumCulled = false;
  car.add(proxy);

  const group = new THREE.Group();
  group.name = 'roadster';
  const inner = new THREE.Group();
  inner.rotation.y = Math.PI / 2;
  inner.add(root);
  group.add(inner);
  group.updateMatrixWorld(true);

  const rest = new Map();
  root.traverse((o) => rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() }));
  const clips = {};
  for (const clip of gltf.animations) {
    const tracks = [];
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const node = n[tr.name.slice(0, dot)];
      const prop = tr.name.slice(dot + 1);
      if (!node || (prop !== 'quaternion' && prop !== 'position') || tr.times.length <= 1) continue;
      tracks.push({ node, prop, interp: tr.createInterpolant() });
    }
    clips[clip.name] = { duration: clip.duration || 1, tracks, last: -1 };
  }
  const setClip = (name, t) => {
    const c = clips[name];
    if (!c || Math.abs(c.last - t) < 1e-4) return;
    c.last = t;
    const time = Math.min(1, Math.max(0, t)) * c.duration;
    for (const tr of c.tracks) {
      const v = tr.interp.evaluate(time);
      if (tr.prop === 'quaternion') tr.node.quaternion.set(v[0], v[1], v[2], v[3]);
      else tr.node.position.set(v[0], v[1], v[2]);
    }
  };

  const toGroup = (node, local = new THREE.Vector3(), out = new THREE.Vector3()) => {
    node.updateWorldMatrix(true, false);
    out.copy(local).applyMatrix4(node.matrixWorld);
    return out;
  };
  const groupLocal = (worldPoint, out = new THREE.Vector3()) => {
    group.updateWorldMatrix(true, false);
    return group.worldToLocal(out.copy(worldPoint));
  };

  const wheelNodes = WHEELS.map((id, i) => {
    const front = i < 2;
    const wheel = n['Wheel_' + id];
    const steer = n['Steer_' + id];
    const brake = n['Brake_' + id];
    const mover = front ? steer || wheel : wheel;
    return { wheel, steer, mover, brake: !front ? brake : null, rest: mover.position.clone(), brakeRest: brake && !front ? brake.position.clone() : null };
  });
  const stat = (() => {
    const c = TUNING.car;
    const S = TUNING.suspension;
    const wb = c.wheelbase / 2;
    const fl = (c.mass * TUNING.gravity * ((wb + c.com[2]) / c.wheelbase)) / 2;
    const rl = (c.mass * TUNING.gravity - fl * 2) / 2;
    return [fl / S.spring_front, fl / S.spring_front, rl / S.spring_rear, rl / S.spring_rear];
  })();
  const rootInv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const nozzleRig = NOZZLES.map((id) => {
    const nz = n['Nozzle_' + id];
    const ex = n['Exhaust_Nozzle_' + id];
    const grp = /^S/.test(id) ? 'side' : /^F/.test(id) ? 'front' : 'rear';
    const exL = grp === 'side' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, grp === 'front' ? 1 : -1);
    if (ex && ex.position.lengthSq() > 1e-8) exL.copy(ex.position).normalize();
    const r = rest.get(nz);
    const parentQ = rootInv.clone().multiply(nz.parent.getWorldQuaternion(new THREE.Quaternion()));
    return { id, grp, node: nz, ex: ex || nz, restQ: r.q.clone(), restAxis: exL.clone().applyQuaternion(r.q), parentInv: parentQ.clone().invert() };
  });

  const jets = NOZZLES.map(() => {
    const g = new THREE.PlaneGeometry(4.0, 1.25);
    g.translate(2.0 - 0.048, 0, 0);
    const m = new THREE.Mesh(g, preserveAlpha(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTex: { value: jetTex }, uFrame: { value: 0 }, uA: { value: 0 }, uL: { value: 2.2 } }, vertexShader: JET_VS, fragmentShader: JET_FS })));
    m.matrixAutoUpdate = false;
    m.matrixWorldAutoUpdate = false;
    m.frustumCulled = false;
    m.renderOrder = 7;
    m.visible = false;
    group.add(m);
    return m;
  });
  const jetLight = new THREE.PointLight(0xb8e4ff, 0, 22, 2);
  group.add(jetLight);

  const heads = new THREE.SpotLight(0xe8f0ff, 0, 70, 0.6, 0.9, 1.8);
  const lampL = n.Lamp_Head_L ? toGroup(n.Lamp_Head_L) : new THREE.Vector3(2.0, 0.65, 0);
  const lampR = n.Lamp_Head_R ? toGroup(n.Lamp_Head_R) : lampL;
  heads.position.copy(groupLocal(lampL).add(groupLocal(lampR)).multiplyScalar(0.5));
  heads.target.position.set(18, -0.4, 0);
  group.add(heads, heads.target);
  const lightBase = { head: mats.LED_Head ? mats.LED_Head.emissiveIntensity : 1, tail: mats.LED_Tail ? mats.LED_Tail.emissiveIntensity : 1 };

  const doors = { doorFL: { value: 0, target: 0, clip: 'door_L_open' }, doorFR: { value: 0, target: 0, clip: 'door_R_open' } };
  const roof = { value: 1, target: 1 };
  const setTarga = (value) => {
    setClip('targa_remove', value);
    if (n.Roof_Targa) n.Roof_Targa.visible = value < 0.97;
  };
  setTarga(roof.value);

  const doorNode = n.Door_L;
  const doorBox = new THREE.Box3();
  doorNode.updateWorldMatrix(true, true);
  const doorInv = new THREE.Matrix4().copy(doorNode.matrixWorld).invert();
  const corner = new THREE.Vector3();
  doorNode.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry.attributes.position) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb || bb.isEmpty()) return;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld).applyMatrix4(doorInv);
      doorBox.expandByPoint(corner);
    }
  });
  const doorPointLocal = (gx, gy, gz) => {
    const w = new THREE.Vector3(gx, gy, gz).applyMatrix4(group.matrixWorld);
    return w.applyMatrix4(doorInv);
  };
  const seatG = n.Seat_Driver ? groupLocal(toGroup(n.Seat_Driver)) : new THREE.Vector3(-0.3, 0.26, -0.36);
  const hip = seatG.clone().add(new THREE.Vector3(0.02, 0.12, 0));
  const handleLocal = doorPointLocal(hip.x + 0.05, 0.78, -0.95);
  const pullLocal = doorPointLocal(hip.x + 0.25, 0.62, -0.72);
  const supportLocal = doorPointLocal(hip.x + 0.15, 0.9, -0.9);

  let sim = null;
  let time = 0;
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  const c = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const steerQ = new THREE.Quaternion();
  const applyDoors = () => {
    for (const d of Object.values(doors)) setClip(d.clip, d.value * d.value * (3 - 2 * d.value));
  };

  const model = {
    id: 'roadster',
    group,
    inner,
    nodes: n,
    panels: {},
    pivots: {},
    windows: {},
    glassMaterials: {},
    mirrors: [],
    headBroken: new THREE.Vector2(),
    tailBroken: new THREE.Vector2(),
    paintUniforms: { uDirt: { value: 0.1 } },
    damageCtx: null,
    damageTexture: null,
    roof,
    seat: hip.clone(),
    steeringWheel: n.SteeringWheel || new THREE.Object3D(),
    wheels: wheelNodes.map((N, i) => ({ group: N.mover, spin: N.wheel, side: i % 2 === 0 ? -1 : 1, front: i < 2, x: (i < 2 ? 1 : -1) * TUNING.car.wheelbase / 2, z: ((i % 2 === 0 ? -1 : 1) * TUNING.car.track_front) / 2 })),
    jets,
    jetLight,
    materials: mats,
    bindSim(s) {
      sim = s;
    },
    bindState() {},
    setRoof(value) {
      roof.value = roof.target = value;
      setTarga(value);
    },
    toggleRoof() {
      roof.target = roof.target > 0.5 ? 0 : 1;
    },
    setDoor(name, open) {
      if (doors[name]) doors[name].target = open ? 1 : 0;
    },
    setDoorAngle(name, amount) {
      const d = doors[name];
      if (!d) return;
      d.value = d.target = Math.min(1, Math.max(0, amount));
      applyDoors();
    },
    doorAmount(name = 'doorFL') {
      return doors[name] ? doors[name].value : 0;
    },
    handlePoint(out = new THREE.Vector3()) {
      return toGroup(doorNode, handleLocal, out);
    },
    innerPullPoint(out = new THREE.Vector3()) {
      return toGroup(doorNode, pullLocal, out);
    },
    supportPoint(out = new THREE.Vector3()) {
      return toGroup(doorNode, supportLocal, out);
    },
    gripPoint(side = 'L', out = new THREE.Vector3()) {
      const node = n[side === 'R' ? 'Grip_R' : 'Grip_L'];
      return node ? toGroup(node, new THREE.Vector3(), out) : toGroup(model.steeringWheel, new THREE.Vector3(), out);
    },
    entryGeometry() {
      return {
        door: 'doorFL',
        seat: hip.clone(),
        spot: new THREE.Vector3(hip.x - 0.2, 0, -1.3),
        stepBack: new THREE.Vector3(hip.x - 0.32, 0, -1.4),
        gap: new THREE.Vector3(hip.x + 0.05, 0, -1.12),
        exitSpot: new THREE.Vector3(hip.x - 0.4, 0, -1.45),
        prompt: new THREE.Vector3(hip.x, 0, -1.45),
        footInR: new THREE.Vector3(hip.x + 0.32, 0.2, -0.62),
        pedalR: new THREE.Vector3(hip.x + 0.7, 0.2, hip.z + 0.085),
        pedalL: new THREE.Vector3(hip.x + 0.64, 0.19, hip.z - 0.1),
        sillY: 0.36,
        brace: new THREE.Vector3(hip.x - 0.15, hip.y + 0.12, -0.08),
        length: TUNING.car.length,
        halfWidth: TUNING.car.width / 2,
      };
    },
    setLights({ brake, beam }) {
      const on = beam ? 1 : 0;
      if (mats.LED_Head) mats.LED_Head.emissiveIntensity = lightBase.head * (0.35 + 0.65 * on) * (1 - model.headBroken.x * 0.5 - model.headBroken.y * 0.5);
      if (mats.LED_Tail) mats.LED_Tail.emissiveIntensity = lightBase.tail * (0.3 + 0.7 * on) * (1 + 2.2 * brake) * (1 - model.tailBroken.x * 0.5 - model.tailBroken.y * 0.5);
      heads.intensity = 420 * on * (1 - (model.headBroken.x + model.headBroken.y) * 0.5);
    },
    applySim(s) {
      const S = TUNING.suspension;
      wheelNodes.forEach((N, i) => {
        const wh = s.wheels[i];
        const drop = S.rest_length - stat[i] - wh.length;
        N.mover.position.set(N.rest.x, N.rest.y + drop, N.rest.z);
        if (N.brakeRest) N.brake.position.set(N.brakeRest.x, N.brakeRest.y + drop, N.brakeRest.z);
        if (N.steer) N.steer.quaternion.copy(rest.get(N.steer).q).multiply(steerQ.setFromAxisAngle(Y, wh.steer || 0));
        N.wheel.quaternion.copy(rest.get(N.wheel).q).multiply(steerQ.setFromAxisAngle(X, wh.spin % (Math.PI * 2)));
      });
      const sw = n.SteeringWheel;
      if (sw) sw.quaternion.copy(rest.get(sw).q).multiply(steerQ.setFromAxisAngle(Z, -s.steerAngle * 4.6));
      s.thrusters.all.forEach((nz, i) => {
        const rig = nozzleRig[i];
        v.set(-nz.dir.x, -nz.dir.y, -nz.dir.z).applyQuaternion(rig.parentInv);
        rig.node.quaternion.copy(q.setFromUnitVectors(rig.restAxis, v)).multiply(rig.restQ);
      });
      setClip('front_nozzles_deploy', s.thrusters.extend);
      setClip('side_nozzles_deploy', s.thrusters.sideDeploy);
      setClip('flap_open', s.thrusters.flap);
    },
    update(dt) {
      time += dt;
      for (const d of Object.values(doors)) {
        if (d.value === d.target) continue;
        d.value += Math.sign(d.target - d.value) * Math.min(Math.abs(d.target - d.value), dt / 0.9);
      }
      applyDoors();
      if (roof.value !== roof.target) {
        roof.value += Math.sign(roof.target - roof.value) * Math.min(Math.abs(roof.target - roof.value), dt / 1.6);
        setTarga(roof.value);
      }
      if (!sim || !ctx.camera) return;
      group.updateMatrixWorld(true);
      const carQ = group.getWorldQuaternion(q).multiply(steerQ.setFromAxisAngle(Y, Math.PI / 2));
      let sum = 0;
      c.set(0, 0, 0);
      const cam = ctx.camera;
      sim.thrusters.all.forEach((nz, i) => {
        const m = jets[i];
        const k = nz.valve;
        m.visible = k > 0.02;
        if (!m.visible) return;
        const rig = nozzleRig[i];
        const p = rig.ex.getWorldPosition(new THREE.Vector3());
        const axis = w.set(-nz.dir.x, -nz.dir.y, -nz.dir.z).applyQuaternion(carQ).normalize();
        let len = 0.5 + 0.5 * k * (rig.grp === 'rear' ? 1.4 : 1);
        if (nz.groundDist < 6) len = Math.min(len, Math.max(0.25, nz.groundDist / 4.0 + 0.1));
        const toCam = cam.position.clone().sub(p);
        const yv = axis.clone().cross(toCam).normalize();
        const zv = axis.clone().cross(yv).normalize();
        m.matrixWorld.makeBasis(axis.clone().multiplyScalar(len), yv.multiplyScalar(0.7 + 0.3 * k), zv).setPosition(p);
        const u = m.material.uniforms;
        u.uA.value = Math.min(1, 0.35 + 0.6 * k);
        u.uFrame.value = time * (30 + 30 * k) + i * 7;
        sum += k;
        c.addScaledVector(p.clone().addScaledVector(axis, 1.6), k);
      });
      jetLight.intensity = 55 * Math.min(2.5, sum);
      jetLight.visible = jetLight.intensity > 0.5;
      if (sum > 0.02) jetLight.position.copy(group.worldToLocal(c.multiplyScalar(1 / sum)));
    },
  };
  return model;
}
