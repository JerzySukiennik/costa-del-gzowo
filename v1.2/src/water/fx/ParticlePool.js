// Costa del Gzowo water: CPU-simulated particle pool (droplets, spray sheets, mist, bubbles) rendered as soft, lit, depth-aware instanced sprites.
import * as THREE from 'three';
import { GLSL_CONSTANTS, GLSL_HASH, GLSL_SCENE, GLSL_OPTICS, GLSL_SHADOW } from '../glsl/common.js';

export const KIND = { DROPLET: 0, SHEET: 1, MIST: 2, BUBBLE: 3 };

const VERT = `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iParams;
varying vec2 vUv;
varying float vKind;
varying float vAlpha;
varying float vSeed;
varying float vLife;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  float size = iParams.x;
  float kind = iParams.z;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 corner = position.xy;
  if (kind < 1.5) {
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 ax = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
    vec2 pr = vec2(ax.y, -ax.x);
    float len = size + sp * (kind < 0.5 ? 0.035 : size * 0.12);
    mv.xy += ax * corner.y * len + pr * corner.x * size;
  } else {
    float a = iParams.w * 6.2831;
    float c = cos(a);
    float s = sin(a);
    mv.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
  }
  vUv = corner + 0.5;
  vKind = kind;
  vAlpha = iParams.y;
  vSeed = iParams.w;
  vLife = 0.0;
  vWorld = iPos;
  vViewZ = mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = `
${GLSL_CONSTANTS}
${GLSL_HASH}
${GLSL_SCENE}
${GLSL_OPTICS}
${GLSL_SHADOW}
uniform sampler2D uFoamTex;
uniform float uWaterLevel;
uniform float uCameraUnder;
varying vec2 vUv;
varying float vKind;
varying float vAlpha;
varying float vSeed;
varying float vLife;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vec2 suv = gl_FragCoord.xy / uResolution;
  float sceneZ = viewFromDepth(suv, texture(uSceneDepth, suv).r).z;
  float gap = vViewZ - sceneZ;
  if (gap <= 0.0) discard;
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir);
  float cosT = dot(-V, L);
  float vis = sunVisibilityFast(vWorld);
  vec3 col;
  float a;
  bool belowSurface = vWorld.y < uWaterLevel;
  if (vKind < 0.5) {
    float shape = 1.0 - smoothstep(0.35, 1.0, r);
    float glint = pow(max(0.0, 1.0 - length(p - vec2(-0.3, 0.3)) * 2.2), 3.0);
    col = uAmbient * 1.1 + uSunColor * vis * (hgPhase(cosT, 0.7) * 0.9 + glint * 0.35);
    a = shape * vAlpha;
    a *= clamp(gap / 0.05, 0.0, 1.0);
  } else if (vKind < 1.5) {
    vec2 nuv = vUv * 0.62 + vec2(vSeed * 3.7, vSeed * 1.3);
    float n1 = texture(uFoamTex, nuv).r;
    float n2 = texture(uFoamTex, nuv * 2.9 + 0.31).r;
    float n3 = texture(uFoamTex, nuv * 0.5 + 0.7).b;
    float edge = 1.0 - smoothstep(0.1, 1.0, r);
    float body = edge * (n1 * 0.65 + n2 * 0.45 + n3 * 0.3);
    float shape = smoothstep(0.42, 0.62, body);
    float core = smoothstep(0.62, 0.9, body);
    vec3 tint = mix(vec3(0.62, 0.86, 0.84), vec3(1.0), core);
    col = (uAmbient * 1.25 + uSunColor * vis * (hgPhase(cosT, 0.45) * 1.3 + 0.13)) * tint;
    a = shape * (0.4 + 0.5 * core) * vAlpha;
    a *= clamp(gap / 0.6, 0.0, 1.0);
  } else if (vKind < 2.5) {
    vec2 nuv = vUv * 0.35 + vec2(vSeed * 3.7, vSeed * 1.3);
    float n = texture(uFoamTex, nuv).r * 0.6 + texture(uFoamTex, nuv * 2.3).b * 0.6;
    float edge = 1.0 - smoothstep(0.15, 1.0, r);
    float shape = clamp(edge * (0.2 + n * 1.0) - 0.2, 0.0, 1.0);
    col = (uAmbient * 1.3 + uSunColor * vis * (hgPhase(cosT, 0.6) * 1.6 + 0.1)) * 0.8;
    a = shape * vAlpha;
    a *= clamp(gap / 0.8, 0.0, 1.0);
  } else {
    float rim = smoothstep(0.55, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
    float hi = pow(max(0.0, 1.0 - length(p - vec2(-0.35, 0.4)) * 3.0), 2.0);
    col = uAmbient * (1.6 * rim + 0.25) + uSunColor * vis * hi * 0.12;
    a = (rim * 0.85 + 0.12 + hi * 0.5) * vAlpha;
    if (uCameraUnder < 0.5) {
      float d = max(0.0, uWaterLevel - vWorld.y);
      vec3 tr = exp(-(uAbsorb + uScatter) * d * 2.2);
      col *= tr;
      a *= 0.75 * dot(tr, vec3(0.33));
    }
    a *= clamp(gap / 0.05, 0.0, 1.0);
  }
  if (uCameraUnder > 0.5 && !belowSurface && vKind < 3.0) a *= 0.12;
  if (a < 0.002) discard;
  gl_FragColor = vec4(min(col, vec3(40.0)) * a, a);
}
`;

export class ParticlePool {
  constructor(max, shared, layer, name) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.kind = new Uint8Array(max);
    this.seed = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.iPos = new Float32Array(max * 3);
    this.iVel = new Float32Array(max * 3);
    this.iParams = new Float32Array(max * 4);
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    this.attrPos = new THREE.InstancedBufferAttribute(this.iPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrVel = new THREE.InstancedBufferAttribute(this.iVel, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrParams = new THREE.InstancedBufferAttribute(this.iParams, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.attrPos);
    geo.setAttribute('iVel', this.attrVel);
    geo.setAttribute('iParams', this.attrParams);
    geo.instanceCount = 0;
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: shared,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(layer);
    this.mesh.renderOrder = 10;
    this.mesh.name = name;
    this.mesh.visible = false;
  }

  spawn(kind, x, y, z, vx, vy, vz, size, life, alpha, drag, grow = 0) {
    if (this.count >= this.max) return -1;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.size[i] = size;
    this.grow[i] = grow;
    this.alpha[i] = alpha;
    this.age[i] = 0;
    this.life[i] = life;
    this.kind[i] = kind;
    this.seed[i] = Math.random();
    this.drag[i] = drag;
    return i;
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3;
    const l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[l3 + k];
      this.vel[i3 + k] = this.vel[l3 + k];
    }
    this.size[i] = this.size[last];
    this.grow[i] = this.grow[last];
    this.alpha[i] = this.alpha[last];
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.kind[i] = this.kind[last];
    this.seed[i] = this.seed[last];
    this.drag[i] = this.drag[last];
  }

  update(dt, env) {
    const g = 9.81;
    for (let i = this.count - 1; i >= 0; i--) {
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const kind = this.kind[i];
      let vx = this.vel[i3];
      let vy = this.vel[i3 + 1];
      let vz = this.vel[i3 + 2];
      const x = this.pos[i3];
      const y = this.pos[i3 + 1];
      const z = this.pos[i3 + 2];
      if (kind === KIND.BUBBLE) {
        env.flowAt(x, z, env.flow);
        const rise = 0.18 + this.size[i] * 6;
        const k = 1 - Math.exp(-dt * 3.5);
        vx += (env.flow.x - vx) * k;
        vz += (env.flow.y - vz) * k;
        vy += (rise - vy) * k;
        const w = this.seed[i] * 40 + this.age[i] * (7 + this.seed[i] * 5);
        this.pos[i3] = x + (vx + Math.sin(w) * 0.12) * dt;
        this.pos[i3 + 1] = y + vy * dt;
        this.pos[i3 + 2] = z + (vz + Math.cos(w * 1.3) * 0.12) * dt;
        const surface = env.heightAt(x, z);
        if (this.pos[i3 + 1] > surface - this.size[i] * 0.3) {
          env.onSurface(x, z, this.size[i]);
          this.kill(i);
          continue;
        }
        if (env.bedAt(x, z) > this.pos[i3 + 1]) this.pos[i3 + 1] = env.bedAt(x, z) + 0.01;
      } else {
        const sp = Math.hypot(vx, vy, vz);
        const d = this.drag[i];
        const f = 1 / (1 + d * sp * dt);
        vx *= f;
        vy *= f;
        vz *= f;
        vy -= g * dt * (kind === KIND.MIST ? 0.06 : kind === KIND.SHEET ? 0.55 : 1);
        this.pos[i3] = x + vx * dt;
        this.pos[i3 + 1] = y + vy * dt;
        this.pos[i3 + 2] = z + vz * dt;
        this.size[i] += this.grow[i] * dt;
        if (kind !== KIND.MIST && vy < 0) {
          const surface = env.heightAt(x, z);
          if (this.pos[i3 + 1] < surface) {
            if (kind === KIND.DROPLET) env.onImpact(x, z, this.size[i], -vy);
            else env.onSheetImpact(x, z, this.size[i], -vy);
            this.kill(i);
            continue;
          }
        }
      }
      this.vel[i3] = vx;
      this.vel[i3 + 1] = vy;
      this.vel[i3 + 2] = vz;
    }
  }

  upload() {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      this.iPos[i3] = this.pos[i3];
      this.iPos[i3 + 1] = this.pos[i3 + 1];
      this.iPos[i3 + 2] = this.pos[i3 + 2];
      this.iVel[i3] = this.vel[i3];
      this.iVel[i3 + 1] = this.vel[i3 + 1];
      this.iVel[i3 + 2] = this.vel[i3 + 2];
      const t = this.age[i] / this.life[i];
      const kind = this.kind[i];
      let a = this.alpha[i];
      if (kind === KIND.DROPLET) a *= 1 - t * t;
      else if (kind === KIND.BUBBLE) a *= Math.min(1, this.age[i] * 6) * (1 - t * t * t);
      else if (kind === KIND.SHEET) a *= Math.min(1, this.age[i] * 10) * (1 - t * t);
      else a *= Math.min(1, this.age[i] * 8) * Math.pow(1 - t, 1.6);
      this.iParams[i4] = this.size[i];
      this.iParams[i4 + 1] = a;
      this.iParams[i4 + 2] = kind;
      this.iParams[i4 + 3] = this.seed[i];
    }
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      for (const attr of [this.attrPos, this.attrVel, this.attrParams]) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, n * attr.itemSize);
        attr.needsUpdate = true;
      }
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
