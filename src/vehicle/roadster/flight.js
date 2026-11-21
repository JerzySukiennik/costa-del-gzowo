// Costa del Gzowo Roadster: flight computer (ground boost and retro, jet take-off, climb while lift is held, altitude hold when released, controlled descent, in-air cruise and braking, rate control with assist and levelling), based on Roadster Jump.
import { V3, Quat, clamp, DEG, MPH } from './math.js';
import { Allocator } from './allocator.js';

export class FlightComputer {
  constructor(tuning, thrusters) {
    this.tu = tuning; this.T = tuning.thrusters; this.F = tuning.flight;
    this.th = thrusters;
    this.alloc = new Allocator(thrusters);
    this.mode = 'ground';
    this.assist = true;
    this.hopT = 0; this.hopReady = 0; this.groundedT = 0; this.airT = 0; this.prevLift = false;
    this.leveling = 0; this.timeToImpact = 99;
    this.flying = false; this.holdAlt = null; this.liftT = 0; this.stopT = 0;
    this.wantF = new V3(); this.wantT = new V3(); this.assistF = new V3();
    this._q = new Quat(); this._q2 = new Quat(); this._e = new V3(); this._v = new V3(); this._fw = new V3(); this._fwd = new V3(); this._lf = new V3();
  }

  rates(inp, w, I, yawScale = 1) {
    const F = this.F, R = F.rate_deg_s, kr = F.rate_gain, rot = { x: inp.pitch, y: inp.steer, z: inp.roll };
    for (const [k, ik, rate] of [['x', 'pitch', R.pitch], ['y', 'yaw', R.yaw * yawScale], ['z', 'roll', R.roll]]) {
      const cmd = rot[k];
      if (Math.abs(cmd) > 0.05) this.wantT[k] = I[ik] * kr * (cmd * rate * DEG - w[k]);
      else if (this.assist) this.wantT[k] = -I[ik] * kr * w[k];
    }
  }

  level(q, fwdW, v, w, I, inp) {
    const F = this.F, yaw = Math.atan2(fwdW.x, fwdW.z);
    const lvl = Math.abs(fwdW.y) > 0.95 ? this._q2.setFromEulerYXZ(0, Math.atan2(v.x, v.z), 0) : this._q2.setFromEulerYXZ(0, yaw, 0);
    this._q.copy(q).conjugate().multiply(lvl);
    const e = this._q.toAxisAngleVec(this._e);
    this.wantT.x = I.pitch * (F.level_kp * e.x - F.level_kd * w.x);
    this.wantT.z = I.roll * (F.level_kp * e.z - F.level_kd * w.z);
    if (Math.abs(inp.steer) < 0.05) this.wantT.y = -I.yaw * F.rate_gain * w.y;
    this.leveling = 1;
  }

  update(dt, inp, s) {
    const T = this.T, F = this.F, th = this.th;
    const g = this.tu.gravity, m = s.mass;
    const grounded = s.contacts >= 2;
    if (grounded) { this.groundedT += dt; this.airT = 0; } else { this.airT += dt; this.groundedT = 0; }
    const liftEdge = inp.lift && !this.prevLift;
    this.liftT = inp.lift ? this.liftT + dt : 0;
    this.prevLift = inp.lift;

    if (this.mode === 'ground') {
      this.flying = false;
      this.holdAlt = null;
      if (liftEdge && grounded) { this.mode = 'hop'; this.hopT = 0; this.hopReady = 0; this.flying = true; }
      else if (!grounded && this.airT > 0.12) this.mode = 'air';
    } else if (this.mode === 'hop') {
      this.hopT += dt;
      th.requestFront(); th.requestSide();
      if (th.deploy >= 0.5 || th.maxFront() <= 0) this.hopReady += dt;
      if (this.hopReady >= T.hop_tap_max_s && (!inp.lift || this.hopReady >= T.hop_hold_max_s || (grounded && this.hopT > 0.6))) this.mode = grounded ? 'ground' : 'air';
    } else if (this.mode === 'air') {
      if (grounded && this.groundedT > 0.05) this.mode = 'ground';
    }

    const q = s.q, v = s.vel;
    const fwdW = this._fwd.set(0, 0, 1).applyQuat(q);
    const hv = Math.hypot(v.x, v.z);
    const fh = hv > 3 ? this._lf.set(v.x / hv, 0, v.z / hv) : Math.hypot(fwdW.x, fwdW.z) > 1e-3 ? this._lf.set(fwdW.x, 0, fwdW.z).normalize() : this._lf.set(1, 0, 0);
    const mph = s.speed / MPH;
    const gov = clamp((F.air_speed_governor_mph[1] - mph) / (F.air_speed_governor_mph[1] - F.air_speed_governor_mph[0]), 0, 1);
    const rearMax = th.maxRear(), frontMax = th.maxFront(), sideMax = th.maxSide();
    const fw = this._fw.set(0, 0, 0);
    const w = s.angLocal, I = s.inertia;
    this.wantT.set(0, 0, 0);
    this.assistF.set(0, 0, 0);
    this.leveling = 0;
    this.timeToImpact = v.y < -0.5 ? s.clearance / -v.y : 99;

    if (this.mode === 'ground' && Math.abs(inp.pitch) > 0.05 && s.speed > 2 && !(inp.boost && inp.brake)) {
      th.requestFront();
      this.wantT.x = I.pitch * F.rate_gain * (inp.pitch * 70 * DEG - w.x);
      if (inp.boost) fw.addScaled(fh, rearMax * gov);
    } else if (this.mode === 'ground') {
      const boost = inp.boost && !inp.brake, retro = inp.boost && inp.brake;
      this.alloc.clear();
      if (retro) th.requestFront();
      for (const n of th.rear) { n.cmdPitch = 0; n.cmdSide = 0; n.cmdValve = boost ? gov * F.ground_boost : 0; }
      for (const n of th.front) { n.cmdPitch = 0; n.cmdSide = 0; n.cmdValve = retro && s.fwdSpeed > 0.5 ? 1 : 0; }
      for (const n of th.side) { n.cmdPitch = 0; n.cmdSide = 0; n.cmdValve = 0; }
      return;
    }

    else if (this.mode === 'hop') {
      const upHop = this._v.set(0, 1, 0).applyQuat(q).y;
      fw.set(0, 1, 0).applyQuat(q).scale(Math.min(rearMax + frontMax + 0.6 * sideMax, m * (g + F.hop_accel)) * clamp((upHop - 0.35) / 0.5, 0, 1));
      if (inp.boost) fw.addScaled(fh, rearMax * gov);
      if (grounded) {
        this.wantT.x = -I.pitch * F.rate_gain * w.x * 0.6;
        this.wantT.z = -I.roll * F.rate_gain * w.z * 0.6;
      } else {
        this.rates(inp, w, I);
        if (this.assist && Math.abs(inp.pitch) < 0.05 && Math.abs(inp.roll) < 0.05) this.level(q, fwdW, v, w, I, inp);
      }
    } else if (this.mode === 'air') {
      if (inp.lift || inp.descend) this.flying = true;
      const hover = this.assist && this.flying;
      if (inp.boost && !hover) fw.addScaled(fh, rearMax * gov);
      this.rates(inp, w, I, hover ? F.hover_yaw / (1 + hv / F.yaw_speed_ref) : 1);
      const upY = this._v.set(0, 1, 0).applyQuat(q).y;
      const near = this.timeToImpact < F.level_time_s || (s.clearance < 3.5 && v.y < 1);
      if (this.assist && (near || hover) && Math.abs(inp.pitch) < 0.05 && Math.abs(inp.roll) < 0.05) this.level(q, fwdW, v, w, I, inp);
      if (hover) {
        const overWater = s.water !== null && s.water !== undefined;
        const floor = overWater ? s.water + F.water_skim : -1e9;
        const room = overWater ? Math.min(s.clearance, Math.max(0, s.altitude - floor)) : s.clearance;
        let az;
        if (inp.lift) {
          const ramp = clamp((this.liftT - 0.5) / 1.7, 0, 1);
          const rate = F.climb_slow + (F.climb_rate - F.climb_slow) * ramp * ramp * (3 - 2 * ramp);
          az = F.climb_gain * (rate * clamp((F.ceiling_m - s.altitude) / 80, 0, 1) - v.y);
          this.holdAlt = null;
        } else if (inp.descend) {
          const L = F.land_rate;
          az = 3.4 * (-Math.min(L[2], L[0] + L[1] * room) * (overWater ? clamp(room / 0.5, 0, 1) : 1) - v.y);
          this.holdAlt = null;
        } else {
          if (this.holdAlt === null && Math.abs(v.y) < 2) this.holdAlt = s.altitude + v.y * 0.3;
          if (this.holdAlt !== null && this.holdAlt < floor) this.holdAlt = floor;
          az = this.holdAlt === null ? -F.hold_kd * v.y : F.hold_kp * (this.holdAlt - s.altitude) - F.hold_kd * v.y;
        }
        if (s.altitude < floor) az = Math.max(az, F.hold_kp * (floor - s.altitude) - F.hold_kd * v.y);
        fw.y += m * (g + clamp(az, -g * 0.95, F.climb_accel)) / Math.max(0.35, upY);
        if (upY < 0.2) fw.y = 0;
        const nose = Math.hypot(fwdW.x, fwdW.z) > 1e-3 ? this._lf.set(fwdW.x, 0, fwdW.z).normalize() : fh;
        const vf = v.x * nose.x + v.z * nose.z;
        if (hv > 3) {
          const way = vf >= 0 ? 1 : -1;
          const along = (nose.x * v.x + nose.z * v.z) / hv;
          const carve = m * Math.min(F.carve_gain * hv, F.carve_max) * way;
          fw.x += carve * (nose.x - (v.x / hv) * along);
          fw.z += carve * (nose.z - (v.z / hv) * along);
        } else {
          fw.x -= m * F.slip_damp * (v.x - nose.x * vf);
          fw.z -= m * F.slip_damp * (v.z - nose.z * vf);
        }
        let along = 0;
        this.stopT = inp.brake > 0.05 && hv < 1.5 ? this.stopT + dt : inp.brake > 0.05 && vf < 0 ? this.stopT : 0;
        if (inp.brake > 0.05 && hv > 1.5 && this.stopT < 0.6) fw.addScaled(this._v.set(v.x / hv, 0, v.z / hv), -m * F.air_brake * inp.brake);
        else if (inp.brake > 0.05) along = this.stopT < 0.6 ? -F.hover_drag * vf : -F.cruise_accel * 0.6 * inp.brake * clamp((F.reverse_speed + vf) / 4, 0, 1);
        else if (inp.boost) along = F.boost_accel * clamp((F.boost_speed - vf) / 12, 0, 1);
        else if (inp.throttle > 0.05) along = vf > F.cruise_speed ? -F.hover_drag * (vf - F.cruise_speed) : F.cruise_accel * inp.throttle * clamp((F.cruise_speed - vf) / 8, 0, 1);
        else along = -F.hover_drag * vf;
        fw.addScaled(nose, m * along);
      } else if (inp.lift) fw.copy(this._v.set(0, 1, 0).applyQuat(q)).scale(sideMax + rearMax + frontMax);
    }

    const any = fw.lenSq() > 1 || Math.abs(this.wantT.x) + Math.abs(this.wantT.y) + Math.abs(this.wantT.z) > 1;
    if (any) {
      th.requestSide(); th.requestFront();
      this.wantF.copy(fw).applyQuatInv(q);
      this.alloc.solve(this.wantF, this.wantT, s.com);
      if (this.mode === 'air' && this.assist && this.flying) {
        const got = this.alloc.achieved;
        this._v.set(this.wantF.x - got[0], this.wantF.y - got[1], this.wantF.z - got[2]).applyQuat(q);
        this.assistF.set(this._v.x, 0, this._v.z);
      }
    } else this.alloc.clear();
  }
}
