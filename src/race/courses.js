// Costa del Gzowo: the race courses (road sprint, off-road rally, two boat runs, a ring flight) as gate lists, plus which vehicles each kind accepts.
import { BRIDGE } from '../config.js';

const STRAIT = [[24, 246], [12, 200], [5, 160], [9, 120], [15, 80], [9, 40], [12, 0], [-10, -40], [-11, -80], [-8, -120], [-6, -160], [-12, -200], [-25, -240]];
const SOUTH = [[204, 218], [165, 268], [122, 326], [70, 330], [40, 292]];
const NORTH = [[-34, -296], [20, -340], [90, -345], [150, -318], [176, -262], [200, -214], [240, -186], [300, -172], [350, -150], [378, -100], [386, -20], [384, 60], [368, 135], [335, 188], [290, 226], [240, 210], [204, 172]];

export const KINDS = {
  car: { label: 'car race', bring: 'a car', vehicles: ['convertible', 'roadster', 'cybertruck'], radius: 10, zone: 16 },
  boat: { label: 'boat race', bring: 'a boat', vehicles: ['speedboat', 'foilboat', 'diver', 'yacht'], radius: 17, zone: 22 },
  air: { label: 'ring flight', bring: 'the helicopter or a Roadster', vehicles: ['heli', 'roadster'], radius: 9, zone: 20 },
};

export const COURSES = [
  {
    id: 'bridge-sprint', name: 'Bridge Sprint', kind: 'car', laps: 1, start: [-212, 0],
    gates: [[-140, 0], [-80, 0], [-24, 0, BRIDGE.deckY], [24, 0, BRIDGE.deckY], [84, 0], [150, 0], [200, 0], [248, 0]],
  },
  {
    id: 'sawgrass-rally', name: 'Sawgrass Rally', kind: 'car', laps: 1, radius: 13, start: [-128, 36],
    gates: [[-150, 70], [-205, 120], [-250, 92], [-266, 30], [-272, -52], [-250, -120], [-190, -150], [-140, -110], [-150, -50], [-190, -20], [-196, 22], [-160, 40], [-128, 36]],
  },
  {
    id: 'strait-run', name: 'Strait Run', kind: 'boat', laps: 1, start: [182, 174],
    gates: [...SOUTH, ...STRAIT.slice(0, 7), [-10, -40], [-11, -90]],
  },
  {
    id: 'island-lap', name: 'Island Lap', kind: 'boat', laps: 1, start: [232, 174],
    gates: [...SOUTH, ...STRAIT, ...NORTH],
  },
  {
    id: 'sky-rings', name: 'Sky Rings', kind: 'air', laps: 1, start: [-128, 5],
    gates: [[-125, 40, 26], [-60, 110, 22], [14, 96, 9], [12, 40, 3.6], [12, 0, 3.4], [10, -50, 6], [40, -130, 26], [120, -150, 46], [200, -60, 40], [214, 40, 30], [204, 130, 16], [204, 200, 7]],
  },
];

export function courseIndex(id) {
  return COURSES.findIndex((c) => c.id === id);
}
