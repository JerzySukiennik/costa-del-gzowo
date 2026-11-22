// Costa del Gzowo: pedestrian skeleton table (23 bones, A-pose bind) shared by the offline bake and the runtime rig.
export const LIMB = { hip: 0.93, hipHalf: 0.095, thigh: 0.44, shin: 0.43, upperArm: 0.29, forearm: 0.26, ankle: 0.061 };
export const BIND_ARM = 0.6;
export const BIND_LEG = 0.05;
export const SIDES = [['L', 1], ['R', -1]];

export function boneTable(shoulder = 0.19) {
  const rows = [
    ['hips', null, 0, LIMB.hip, 0, 0],
    ['spine', 'hips', 0, 0.06, 0, 0],
    ['chest', 'spine', 0, 0.2, 0, 0],
    ['neck', 'chest', 0, 0.27, -0.03, 0],
    ['head', 'neck', 0, 0.14, 0.03, 0],
  ];
  for (const [t, s] of SIDES) rows.push(['eye' + t, 'head', s * 0.032, 0.072, 0.067, 0]);
  for (const [t, s] of SIDES) {
    rows.push(
      ['clavicle' + t, 'chest', s * 0.025, 0.2, 0.035, 0],
      ['shoulder' + t, 'clavicle' + t, s * (shoulder - 0.025), 0.025, -0.035, s * BIND_ARM],
      ['elbow' + t, 'shoulder' + t, 0, -LIMB.upperArm, 0, 0],
      ['wrist' + t, 'elbow' + t, 0, -LIMB.forearm, 0, 0],
      ['hip' + t, 'hips', s * LIMB.hipHalf, 0, 0, s * BIND_LEG],
      ['knee' + t, 'hip' + t, 0, -LIMB.thigh, 0, 0],
      ['ankle' + t, 'knee' + t, 0, -LIMB.shin, 0, -s * BIND_LEG],
      ['toe' + t, 'ankle' + t, 0, -0.045, 0.138, 0],
    );
  }
  return rows;
}
