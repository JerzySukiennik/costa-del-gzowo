// Costa del Gzowo film: video 5 "Golden hour", a wordless ride on the Roadster's nose cut to the quiet stretch and the lift of Monkeys Spinning Monkeys.
(window.__filmVideos = window.__filmVideos || {}).v5 = {
  music: { file: 'monkeys_spinning_monkeys.wav', songAt: 52.512, videoAt: 0, fadeOut: 2.4 },
  shots: (F) => {
    const PO = window.__filmPoses;
    const D = [0, 1.674, 3.322, 4.994, 6.666, 8.338, 9.998, 11.658, 13.33, 14.99, 16.662, 18.334, 20.029, 21.747, 23.466, 25.184, 26.867, 28.539, 30.211, 31.871, 33.531, 35.203, 36.863, 38.535, 40.207, 41.867, 43.539, 45.211, 46.883, 48.543, 50.215];
    const HIT1 = 14.154;
    const CX = -118, CZ = 14;
    const gy = (x = CX, z = CZ) => F.groundY(x, z);
    const parked = (lift = 0, pitch = 0, roll = 0) => F.carPose(CX, gy() + lift, CZ, 0, pitch, roll);
    const LIE = { pos: [2.05, 0.6, 0], up: [-0.93, 0.36, 0], face: [0.36, 0.93, 0] };
    const STAND = { pos: [1.15, 0.9, 0], up: [0, 1, 0], face: [0, 0, 1] };
    const S = (name, a, z, o) => ({ name, dur: z - a, pre: o.pre ?? 0.8, ...o, edit: o.edit || {} });
    const onFoot = (x, z, yaw) => {
      F.play.game.beams = false;
      F.placeCar(parked());
      F.setJets(null);
      F.foot(x, z, yaw);
    };
    const resting = (F) => {
      F.play.game.beams = false;
      F.placeCar(parked());
      F.setJets(null);
      F.ride(LIE);
    };
    const chasePts = [[-112, 3.2, 14], [-86, 12, 16], [-58, 17, 22], [-30, 15, 30]];
    const bridgeRun = (t) => F.carPose(12 + 0.4 * Math.sin(t * 0.9), 3.4 + 0.1 * Math.sin(t * 2.3), -52 + 24 * t, -Math.PI / 2, 0.02, 0.05 * Math.sin(t * 1.4));
    const skim = (t) => F.carPose(10 + 0.6 * Math.sin(t * 0.8), 1.5 + 0.08 * Math.sin(t * 3.1), 40 + 18 * t, -Math.PI / 2 + 0.05 * Math.sin(t * 0.8), 0.03, 0.06 * Math.sin(t * 1.1));
    const climbPts = [[12, 1.6, 60], [12, 6, 80], [12, 26, 104], [12, 58, 124], [12, 82, 136]];
    const high = (t, roll = 0) => F.carPose(-10 + 3 * t, 78 + 0.4 * Math.sin(t * 1.3), 120 + 13 * t, -Math.PI / 2 - 0.25, 0.02, roll);
    const sky = (t) => F.carPose(-70 + 2 * t, 160 - 0.5 * t, -230 + 20 * t, -Math.PI / 2 - 0.1, -0.05, 0.06 * Math.sin(t));
    const lieStill = (t) => {
      const p = PO.lieBack(t);
      p.legR = -0.2;
      p.kneeR = 0.3;
      return p;
    };
    const surfer = (t) => {
      const p = PO.surf(t);
      p.headYaw = -0.25;
      p.spineTwist = -0.15;
      return p;
    };
    return [
      S('vista', D[0], D[2], {
        setup(F) { onFoot(-133, 17.2, Math.PI / 2); },
        tick(F) { F.stopWalk(); F.pose(PO.stand(), 10); },
        post(F, t) {
          const k = F.ease.inOut(t / 3.32);
          F.look([F.lerp(-96, -104, k), F.lerp(26, 6.5, k), F.lerp(-3, 1.5, k)], [F.lerp(-116, -124, k), F.floorY(-120, 15) + F.lerp(0.5, 1.0, k), F.lerp(14, 16, k)], F.lerp(46, 40, k));
        },
      }),
      S('crocs', D[2], D[4], {
        setup(F) { onFoot(-132.5, 17.3, Math.PI / 2); },
        tick(F) { F.free(); F.walk(Math.PI / 2); },
        post(F, t) {
          const h = F.hipsWorld();
          const g = F.floorY(h.x, h.z);
          F.look([h.x + 1.3, g + 0.22, h.z + 1.0 - 0.15 * t], [h.x - 0.1, g + 0.18, h.z], 46);
        },
      }),
      S('stride', D[4], D[6], {
        setup(F) { onFoot(-127.5, 17.3, Math.PI / 2); },
        tick(F) { F.free(); F.walk(Math.PI / 2); },
        post(F, t) {
          const h = F.headWorld();
          F.look([h.x + 2.7, h.y - 0.45, h.z - 0.6], [h.x, h.y - 0.2, h.z], 34);
        },
      }),
      S('nose', D[6], HIT1, {
        setup(F) { onFoot(CX + 3.3, CZ + 0.4, -Math.PI / 2); },
        tick(F, t) {
          F.stopWalk();
          const p = PO.stand();
          p.headPitch = 0.12 + 0.3 * F.smooth((t - 1.2) / 1.2);
          p.headYaw = -0.15 * F.smooth((t - 2.6) / 0.8);
          F.pose(p, 8);
        },
        post(F, t) {
          const p = F.carLocal(1.25 - 0.2 * F.smooth(t / 4.2), 0.82, -0.35);
          const h = F.headWorld();
          F.look([p.x, p.y, p.z], [h.x, h.y - 0.1, h.z], 44 - 6 * F.smooth(t / 4.2));
        },
      }),
      S('overhead', HIT1, D[9], {
        setup(F) { resting(F); },
        tick(F, t) { F.pose(lieStill(t), 60); },
        post(F, t) {
          const c = F.carLocal(0.9, 0.8, 0);
          F.look([c.x + 0.01, c.y + 6.5, c.z], [c.x, c.y, c.z], 44, -0.25 + 0.12 * t);
        },
      }),
      S('face', D[9], D[10], {
        setup(F) { resting(F); },
        tick(F, t) { F.pose(lieStill(t + 1), 60); },
        post(F, t) {
          const h = F.headWorld();
          F.look([h.x + 0.75, h.y + 0.7 + 0.05 * t, h.z + 0.35 - 0.2 * t], [h.x, h.y, h.z], 36);
        },
      }),
      S('wake', D[10], D[11], {
        setup(F) { resting(F); F.play.game.beams = true; },
        tick(F, t) {
          const k = F.smooth(t / 1.6);
          F.setJets({ side: 0.9 * k, rear: 0, deploy: F.clamp(t / 0.5, 0, 1), extend: 1 });
          F.driveCar(parked(0.55 * k + 0.02 * Math.sin(t * 40) * k, 0.01 * Math.sin(t * 9) * k, 0.015 * Math.sin(t * 7) * k));
          F.pose(lieStill(t + 2), 60);
        },
        post(F, t) {
          F.camCar([3.6 - 0.4 * t, 0.35, 5.2 - 0.3 * t], [0.2, 0.75, 0.3], 44);
        },
      }),
      S('launch', D[11], D[13], {
        setup(F) { F.play.game.beams = true; F.placeCar(parked(0.55)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: t > 0.02 ? 1 : 0, side: 0.8, deploy: 1, extend: 1, flap: 1 });
          const x = CX + 3 * t + 5.5 * t * t;
          F.driveCar(F.carPose(x, gy() + 0.55 + 2.4 * F.ease.in(t / 3.4) * t, CZ + 0.4 * t, 0, 0.06 * F.smooth(t / 1.2), 0));
          F.pose(lieStill(t + 3), 30);
        },
        post(F, t) {
          const c = F.carLocal(0.5, 0.8, 0);
          F.look([-109, F.floorY(-109, 21.5) + 0.9, 21.5], [c.x, c.y, c.z], 52 - 10 * F.smooth((t - 1.2) / 2.2));
          F.shake(0.05 * Math.exp(-Math.abs(t - 1.05) * 3), t);
        },
        edit: { sfx: [[0.95, 'whoosh_fast', 0.55]] },
      }),
      S('chase', D[13], D[15], {
        setup(F) { F.play.game.beams = true; F.placeCar(F.flight(chasePts, 0, 0.12)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 0.9, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.flight(chasePts, F.clamp(t / 3.44, 0, 1) * 0.94, 0.12, 0.7));
          F.pose(lieStill(t + 6), 20);
        },
        post(F, t) { F.camCar([-6.4, 4.0, -1.2 + 0.5 * t], [1.8, 0.7, 0], 48); },
      }),
      S('bridge', D[15], D[17], {
        flare: true,
        setup(F) { F.play.game.beams = true; F.placeCar(bridgeRun(0)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 0.9, side: 0.7, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(bridgeRun(t));
          F.pose(lieStill(t + 9), 20);
        },
        post(F, t) {
          const c = F.carLocal(0.5, 0.8, 0);
          F.look([7.2, 1.1, 7], [c.x, c.y, c.z], 56);
        },
        edit: { sfx: [[2.15, 'whoosh', 0.6]] },
      }),
      S('skim', D[17], D[19], {
        setup(F) { F.play.game.beams = true; F.placeCar(skim(0)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 0.8, side: 0.8, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(skim(t));
          const p = lieStill(t + 12);
          p.armR = -0.3 + 0.15 * Math.sin(t * 2);
          p.armOutR = 1.35;
          p.elbowR = 0.15;
          p.gripR = 0.05;
          p.spreadR = 0.9;
          F.pose(p, 6);
        },
        post(F, t) { F.camCar([3.9 - 0.3 * t, 1.25, 0.9], [0.7, 1.05, 0], 42); },
      }),
      S('climb', D[19], D[21], {
        setup(F) { F.play.game.beams = true; F.placeCar(F.flight(climbPts, 0, 0.3)); F.ride(LIE); },
        tick(F, t) {
          F.setJets({ rear: 1, side: 0.5, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.flight(climbPts, F.clamp(t / 3.33, 0, 1) * 0.92, 0.3, 1));
          F.pose(lieStill(t + 15), 20);
        },
        post(F, t) {
          const c = F.carLocal(0, 0.5, 0);
          F.look([24, 1.4, 70], [c.x, c.y, c.z], 58);
        },
      }),
      S('surf', D[21], D[23], {
        setup(F) { F.play.game.beams = true; F.placeCar(high(0)); F.ride(STAND); },
        tick(F, t) {
          F.setJets({ rear: 0.8, side: 0.7, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(high(t, 0.08 * Math.sin(t * 1.2)));
          F.pose(surfer(t), 6);
        },
        post(F, t) {
          const c = F.carLocal(1.15, 1.4, 0);
          F.camOrbit([c.x, c.y, c.z], 5.2, 0.9, 2.4 + 1.3 * F.ease.inOut(t / 3.33), 50, 0.1);
        },
      }),
      S('roll', D[23], D[25], {
        setup(F) { F.play.game.beams = true; F.placeCar(high(3.33)); F.ride(STAND); },
        tick(F, t) {
          F.setJets({ rear: 0.8, side: 0.7, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(high(3.33 + t, -F.TAU * F.ease.inOut((t - 0.4) / 2.6)));
          F.pose(PO.tpose(), 20);
        },
        post(F, t) {
          const c = F.carLocal(0, 0, 0);
          F.look([c.x - 3.5, c.y + 1.6, c.z - 9.5], [c.x, c.y + 0.6, c.z], 48);
        },
        edit: { sfx: [[0.4, 'whoosh', 0.45]] },
      }),
      S('island', D[25], D[27], {
        setup(F) { F.play.game.beams = true; F.placeCar(sky(0)); F.ride(STAND); },
        tick(F, t) {
          F.setJets({ rear: 0.8, side: 0.7, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(sky(t));
          F.pose(surfer(t + 4), 6);
        },
        post(F, t) {
          const c = F.carLocal(0, 0, 0);
          F.look([c.x - 3 + 0.3 * t, c.y + 5.5 + 0.6 * t, c.z - 16 - 1.5 * t], [c.x + 0.2 * (0 - c.x), c.y - 40, c.z + 60], 58);
        },
      }),
      S('sunset', D[27], D[30], {
        flare: true,
        setup(F) { F.play.game.beams = true; F.placeCar(high(10)); F.ride(STAND); },
        tick(F, t) {
          F.setJets({ rear: 1, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          const p = high(10);
          F.driveCar(F.carPose(p.p.x + 1.5 * t, p.p.y + 1.0 * t, p.p.z + 16 * t + 2.2 * t * t, -Math.PI / 2, 0.03, 0));
          F.pose(PO.wave(t), 10);
        },
        post(F, t) {
          const p = high(10).p;
          F.look([p.x + 0.4, p.y + 1.6, p.z - 13], [p.x + 0.6 * t, p.y + 0.4 + 0.3 * t, p.z + 40], 44);
        },
      }),
    ];
  },
};
