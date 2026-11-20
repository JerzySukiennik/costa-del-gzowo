// Costa del Gzowo: avatar proportions shared by the skeleton, the sculpt and the mesher worker.
export const DIM = { hip: 0.93, torso: 0.5, shoulder: 0.19, hipHalf: 0.095, upperArm: 0.29, forearm: 0.26, thigh: 0.44, shin: 0.43 };
export const BIND_ARM = 0.6;
export const BIND_LEG = 0.05;
export const SIDES = [['L', 1], ['R', -1]];

export const FINGERS = {
  index: { base: [0.002, -0.094, 0.026], len: [0.043, 0.026, 0.021], r: [0.0098, 0.0086, 0.0076, 0.0068], spread: -0.1 },
  middle: { base: [0.003, -0.098, 0.0075], len: [0.047, 0.03, 0.022], r: [0.0102, 0.0089, 0.0078, 0.007], spread: 0.0 },
  ring: { base: [0.002, -0.094, -0.0105], len: [0.044, 0.028, 0.021], r: [0.0096, 0.0084, 0.0074, 0.0066], spread: 0.08 },
  pinky: { base: [-0.0005, -0.086, -0.0275], len: [0.034, 0.021, 0.019], r: [0.0084, 0.0074, 0.0066, 0.006], spread: 0.19 },
};
export const THUMB = { base: [-0.009, -0.028, 0.017], dir: [-0.3, -0.85, 0.42], flex: [-0.65, -0.1, -0.75], len: [0.04, 0.03, 0.024], r: [0.0112, 0.0094, 0.0086, 0.0074] };
