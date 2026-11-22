// Costa del Gzowo film: video 1 "How to get a free ride (tutorial)" cut to Sneaky Snitch.
(window.__filmVideos = window.__filmVideos || {}).v1 = {
  music: { file: 'sneaky_snitch.wav', songAt: 0, videoAt: 2.4, endAt: null },
  shots: (F) => {
    const PO = window.__filmPoses;
    const B = (n) => 3.754 + 0.6898 * n;
    const P0 = [-120, 0, 14];
    const ground = () => F.groundY(P0[0], P0[2]);
    const parked = (lift = 0) => F.carPose(P0[0], ground() + lift, P0[2], 0);
    const LIE = { pos: [2.05, 0.6, 0], up: [-0.93, 0.36, 0], face: [0.36, 0.93, 0] };
    const stiff = () => PO.P({ arm_: 0.05, armOut_: 0.08, elbow_: 0.05, grip_: 0.1, headPitch: 0.3, foot_: 0.6, legOut_: 0.01 });
    const S = (name, a, b, o) => ({ name, dur: b - a, pre: o.pre ?? 0.6, ...o });
    const onFoot = (x, z, yaw) => {
      F.play.game.beams = false;
      F.placeCar(parked());
      F.setJets(null);
      F.foot(x, z, yaw);
    };
    const tposeRide = { pos: [1.2, 0.9, 0], up: [0, 1, 0], face: [1, 0, 0] };
    const hover = (T) => {
      const z = 26 + 3 * T;
      return F.carPose(12, 6 + 0.25 * Math.sin(T * 2.1), z, -Math.PI / 2, 0.03 * Math.sin(T * 1.7), 0.05 * Math.sin(T * 1.3));
    };
    return [
      S('cold', 0, 2.4, {
        setup(F) { F.placeCar(hover(0)); F.setJets({ rear: 0.25, side: 0.9, deploy: 1, extend: 1 }); F.ride(tposeRide); },
        tick(F, t) { F.driveCar(hover(t + 1.0)); F.pose(PO.tpose(), 40); },
        post(F, t) { F.camCar([5.2, 1.0, -3.0], [1.2, 2.0, 0], 50); },
        edit: {
          freeze: [[0.9, 1.5]],
          grade: [[0.9, 2.4, 'sepia']],
          sfx: [[0.9, 'scratch', 0.9]],
          captions: [[0.95, 2.4, 'yep, that\'s me.', 'meme', 360], [1.25, 2.4, "you're probably wondering\nhow i got here", 'meme-small', 1270]],
        },
      }),
      S('establish', 2.4, B(2), {
        setup(F) { onFoot(-140, 9, Math.PI / 2); },
        post(F, t) {
          const k = F.ease.out(t / 2.7);
          F.look([F.lerp(-96, -104, k), F.lerp(24, 9, k), F.lerp(48, 34, k)], [-121, ground() + 1.0, 13], 55);
        },
        edit: { captions: [[0.15, 2.73, 'HOW TO GET\nA FREE RIDE', 'title', 380], [0.6, 2.73, '(tutorial)', 'meme-small', 640]], sfx: [[0.15, 'ding', 0.5]] },
      }),
      S('peek', B(2), B(6), {
        setup(F) { onFoot(-133, 12, Math.PI / 2); },
        tick(F, t) { F.stopWalk(); F.pose(PO.sneak(t * 0.9), 25); },
        post(F, t) {
          const h = F.headWorld();
          const k = F.ease.inOut(t / 2.76);
          F.look([h.x + 1.5 - 0.3 * k, h.y + 0.05, h.z + 1.25 - 0.25 * k], [h.x, h.y - 0.1, h.z], 38);
        },
        edit: { captions: [[0.2, 2.76, 'STEP 1:', 'step', 300], [0.2, 2.76, 'be sneaky', 'meme', 1350]], sfx: [[0.2, 'hitmarker', 0.6]] },
      }),
      S('sneak', B(6), B(14), {
        setup(F) { onFoot(-138, 10.5, Math.PI / 2); },
        tick(F, t) { F.walk(Math.PI / 2 + 0.06); F.pose(PO.sneak(t), 18); },
        post(F, t) { F.camChar([-3.1, 1.0, 1.2], [0, 0.85, 0.35], 54); },
        edit: { sfx: [[0.05, 'tiptoe', 0.35]] },
      }),
      S('alert', B(14), B(16), {
        setup(F) { F.placeCar(parked()); F.setJets(null); F.play.game.beams = false; F.foot(-127, 14.5, Math.PI / 2); },
        tick(F, t) { F.stopWalk(); F.play.game.beams = t > 0.22; F.pose(PO.sneak(0.5), 25); },
        post(F, t) { F.camCar([3.6, 0.85, 1.9], [1.9, 0.62, 0.62], 34); },
        edit: {
          freeze: [[0.3, 1.08]],
          zoom: [[0.3, 1.0, 0.5, 0.5], [0.45, 1.25, 0.5, 0.5]],
          sfx: [[0.3, 'mgs_alert', 0.8]],
          captions: [[0.32, 1.38, '!', 'alert', 640]],
        },
      }),
      S('freeze', B(16), B(18), {
        setup(F) { F.placeCar(parked()); F.setJets(null); F.play.game.beams = true; F.foot(-125.2, 16.4, Math.PI / 2 + 0.5); },
        tick(F, t) { F.stopWalk(); F.pose(PO.tpose(), 60); },
        post(F, t) { F.camChar([0.35, 1.3, 2.6], [0, 1.25, 0], 48); },
        edit: { zoom: [[0, 1.0, 0.5, 0.42], [0.08, 1.38, 0.5, 0.36]], sfx: [[0, 'vine_boom', 0.9]], captions: [[0.05, 1.38, 'act natural', 'meme', 1350]] },
      }),
      S('ornament', B(18), B(26), {
        setup(F) { F.play.game.beams = true; F.placeCar(parked()); F.setJets(null); F.ride(LIE); },
        tick(F, t) { F.pose(stiff(), 60); },
        post(F, t) {
          const c = F.carLocal(1.1, 0.95, 0);
          F.camOrbit([c.x, c.y, c.z], 3.6, 1.9, 0.15 + 0.85 * F.ease.inOut(t / 5.5), 50, -0.1);
        },
        edit: { sfx: [[0, 'boing', 0.6]], captions: [[0.25, 5.52, 'STEP 2:', 'step', 300], [0.25, 5.52, 'become a\nhood ornament', 'meme', 1260]] },
      }),
      S('lift', B(26), B(30), {
        setup(F) { F.play.game.beams = true; F.placeCar(parked()); F.ride(LIE); const c = F.carLocal(0.9, 0.45, 5.6); F.cam0 = [c.x, c.y, c.z]; },
        tick(F, t) {
          const up = F.ease.inOut((t - 0.3) / 2.2);
          F.setJets({ side: t > 0.25 ? 1 : 0, deploy: F.clamp(t / 0.3, 0, 1), extend: 1, rear: 0 });
          F.driveCar(F.carPose(P0[0], ground() + 1.15 * up + 0.04 * Math.sin(t * 7) * up, P0[2], 0, 0.02 * Math.sin(t * 3) * up, 0.03 * Math.sin(t * 2.3) * up));
          F.pose(stiff(), 60);
        },
        post(F, t) {
          const tg = F.carLocal(0.2, 0.55 + 0.2 * F.smooth(t / 2.7), 0);
          F.look(F.cam0, [tg.x, tg.y, tg.z], 68);
        },
        edit: { captions: [[0.6, 2.76, 'wait...', 'meme', 1350]] },
      }),
      S('uhoh', B(30), B(32), {
        setup(F) { F.play.game.beams = true; F.placeCar(F.carPose(P0[0], ground() + 1.15, P0[2], 0)); F.setJets({ side: 1, deploy: 1, extend: 1, rear: 0 }); F.ride(LIE); },
        tick(F, t) { F.driveCar(F.carPose(P0[0], ground() + 1.15 + 0.04 * Math.sin(t * 7), P0[2], 0)); F.pose(PO.P({ arm_: 0.05, armOut_: 0.08, elbow_: 0.05, headPitch: 0.55, headYaw: 0.25, foot_: 0.6 }), 12); },
        post(F, t) { F.camCar([1.15, 2.05, 0.35], [0.42, 1.38, 0.0], 34); },
        edit: { zoom: [[0, 1.0, 0.5, 0.45], [1.3, 1.15, 0.5, 0.45]], sfx: [[0.35, 'bruh', 1.0]], captions: [[0.3, 1.38, 'uh oh', 'meme', 1350]] },
      }),
      S('launch', B(32), B(38), {
        setup(F) {
          F.play.game.beams = true;
          F.placeCar(F.carPose(P0[0], ground() + 1.15, P0[2], 0));
          F.ride(LIE);
          F.cam0 = [P0[0] - 9, ground() + 1.4, P0[2] + 5.5];
        },
        tick(F, t) {
          const x = P0[0] + 4.6 * t * t;
          const y = ground() + 1.15 + 13 * F.ease.in(t / 4.2) + 2 * F.smooth(t / 1.5);
          F.setJets({ rear: t > 0.05 ? 1 : 0, side: 0.7, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(x, y, P0[2] - 1.2 * F.smooth(t / 4), 0, 0.08 * F.smooth(t / 1.2), 0));
          F.pose(PO.P({ arm_: -0.6 - 0.4 * Math.sin(t * 13), armOut_: 1.1 + 0.4 * Math.sin(t * 11), elbow_: 0.3, legOut_: 0.25 + 0.15 * Math.sin(t * 15), headPitch: 0.2, foot_: 0.6 }), 25);
        },
        post(F, t) {
          const c = F.carLocal(0.5, 1.0, 0);
          F.look(F.cam0, [c.x, c.y, c.z], 52 - 10 * F.smooth(t / 4));
          F.shake(0.12 * Math.exp(-t * 1.5), t);
        },
        edit: { flash: [0.04], sfx: [[0.04, 'airhorn', 0.75]], zoom: [[0, 1.12, 0.5, 0.5], [0.4, 1.0, 0.5, 0.5]] },
      }),
      S('aerial', B(38), B(46), {
        setup(F) { F.play.game.beams = true; F.placeCar(F.carPose(4, 7, -110, -Math.PI / 2)); F.ride(LIE); },
        tick(F, t) {
          const z = -110 + 13 * t;
          F.setJets({ rear: 0.85, side: 0.6, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(4 + 1.2 * Math.sin(t * 0.6), 7 + 0.6 * Math.sin(t * 1.1), z, -Math.PI / 2 + 0.08 * Math.sin(t * 0.6), 0.03, 0.12 * Math.cos(t * 0.6)));
          F.pose(PO.lieBack(t), 6);
        },
        post(F, t) {
          const c = F.carLocal(0.9, 1.0, 0);
          const k = t / 5.5;
          F.look([c.x + 7.5 - 2.5 * k, c.y + 2.2, c.z - 4.5 + 6 * k], [c.x, c.y + 0.2, c.z], 50);
        },
        edit: { captions: [[0.2, 5.52, 'STEP 3:', 'step', 300], [0.2, 5.52, '???', 'meme', 1350]] },
      }),
      S('surf', B(46), B(54), {
        setup(F) { F.play.game.beams = true; F.placeCar(F.carPose(12, 3.2, -48, -Math.PI / 2)); F.ride({ pos: [1.15, 0.9, 0], up: [0, 1, 0], face: [0, 0, -1] }); },
        tick(F, t) {
          const z = -48 + 15.5 * t;
          F.setJets({ rear: 0.9, side: 0.8, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(12 + 0.8 * Math.sin(t * 0.9), 3.2 + 0.25 * Math.sin(t * 2.3), z, -Math.PI / 2, 0.02, 0.12 * Math.sin(t * 1.4)));
          const s = PO.surf(t);
          s.headYaw = -1.0;
          s.spineTwist = 0.35;
          F.pose(s, 8);
        },
        post(F, t) {
          const c = F.carLocal(1.2, 1.7, 0);
          F.look([21, 2.2, 44], [c.x, c.y, c.z], 48 - 8 * F.smooth(t / 5.5));
        },
        edit: { captions: [[0.3, 5.52, 'STEP 4:', 'step', 300], [0.3, 5.52, 'PROFIT', 'meme-big', 1300]], sfx: [[0.3, 'hitmarker', 0.6], [0.42, 'hitmarker', 0.6], [0.54, 'hitmarker', 0.6]] },
      }),
      S('dominance', B(54), B(58), {
        setup(F) { F.play.game.beams = true; F.placeCar(hover(0)); F.setJets({ rear: 0.25, side: 0.9, deploy: 1, extend: 1 }); F.ride(tposeRide); },
        tick(F, t) { F.driveCar(hover(t)); F.pose(PO.tpose(), 40); },
        post(F, t) {
          const c = F.carLocal(1.2, 1.3, 0);
          F.camOrbit([c.x, c.y, c.z], 4.6, 0.9, -1.2 - 2.6 * F.ease.inOut(t / 2.76), 52, 0.45);
        },
        edit: { sfx: [[0, 'vine_boom', 0.8]], captions: [[0, 2.76, 'asserting\ndominance', 'meme', 1260]] },
      }),
      S('sunset', B(58), B(62) + 1.6, {
        flare: true,
        setup(F) { F.play.game.beams = true; F.placeCar(hover(9)); F.ride(tposeRide); },
        tick(F, t) {
          const z = 53 + 2 * t + 5 * t * t;
          F.setJets({ rear: t > 0.2 ? 1 : 0.3, side: 0.8, deploy: 1, extend: 1, flap: 1 });
          F.driveCar(F.carPose(12, 6.2 + 1.6 * t * t * 0.5, z, -Math.PI / 2, 0.1 * F.smooth(t / 1.5), 0));
          F.pose(PO.wave(t), 10);
        },
        post(F, t) {
          const k = F.ease.out(t / 2.76);
          const c = F.carLocal(0.5, 1.0, 0);
          F.look([F.lerp(15, 4, k), F.lerp(8, 30, k), F.lerp(40, 5, k)], [c.x, c.y, c.z], F.lerp(55, 42, k));
        },
        edit: {
          freeze: [[2.76, 1.6]],
          sfx: [[2.78, 'wow', 1.0]],
          captions: [[0.4, 2.76, 'like & subscribe\nfor more tutorials', 'meme-small', 1300], [2.78, 4.36, 'FREE RIDE\nACQUIRED', 'title', 520]],
          musicEnd: 2.76,
        },
      }),
    ];
  },
};
