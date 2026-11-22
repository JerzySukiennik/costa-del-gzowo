// Costa del Gzowo: every traffic node that is NOT derived from the town street plan (the open road, the bridge approach and the west turnaround), in world coordinates; move these when the map changes.
export const HIGHWAY = {
  lane: 2.25,
  centre: [[-226, 0], [-150, 0], [-48, 0], [48, 0], [108, 0]],
  speed: [18.5, 18.5, 15.5, 13],
};

export const WEST_TURN = { x: -226, z: 0, radius: 5.2, swing: 5.1, heading: -1 };

export const TOWN_SPEED = { main: 9.6, cross: 8.2, alley: 4.8, turn: 4.2, uturn: 3.4 };
