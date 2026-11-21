// Costa del Gzowo: shared world constants (meters, Y up, river flows toward +Z, bridge runs along X at z = 0).

export const GAME = {
  title: 'Costa del Gzowo',
};

export const MUSIC = {
  title: {
    url: 'assets/music/love-is-a-long-road.mp3', youtube: 'xAgUYyosqVM', title: 'Love Is a Long Road', artist: 'Tom Petty and the Heartbreakers',
    own: { url: 'assets/music-public/gzowo-labs-moon-mission.mp3', title: 'Moon Mission', artist: 'Gzowo Labs' },
  },
  menu: {
    url: 'assets/music/hot-together.mp3', youtube: 'H3Aay-47ZT0', title: 'Hot Together', artist: 'The Pointer Sisters',
    own: { url: 'assets/music-public/gzowo-labs-untitledtypebeat.mp3', title: 'untitledtypebeat', artist: 'Gzowo Labs' },
  },
};

export const RADIO = [
  { id: 'riviera', name: 'Riviera', frequency: '107.1', genre: 'French House' },
  { id: 'costa-club', name: 'Costa Club', frequency: '99.9', genre: 'House' },
  { id: 'euro-9x', name: 'Euro 9X', frequency: '93.3', genre: 'Eurodance' },
  { id: 'funk-narew', name: 'Funk Narew', frequency: '96.4', genre: 'Disco and Funk' },
  { id: 'moonwalk', name: 'Moonwalk FM', frequency: '102.5', genre: 'King of Pop' },
  { id: 'narew-rock', name: 'Narew Rock', frequency: '98.6', genre: 'Rock' },
  { id: 'costa-fm', name: 'Costa FM', frequency: '101.2', genre: '80s Pop' },
  { id: 'zlota-godzina', name: 'Złota Godzina', frequency: '104.8', genre: 'Synth' },
  { id: 'blok', name: 'Blok', frequency: '90.5', genre: 'Hip-Hop' },
  { id: 'filharmonia', name: 'Filharmonia', frequency: '88.1', genre: 'Score' },
  { id: 'renifer', name: 'Radio Renifer', frequency: '100.0', genre: 'Christmas' },
  { id: 'szanghaj', name: 'Szanghaj FM', frequency: '95.0', genre: 'C-Pop' },
  { id: 'fala-prl', name: 'Fala PRL', frequency: '89.4', genre: 'Polish Classics' },
  { id: 'gzowo-labs', name: 'Gzowo Labs Radio', frequency: '108.0', genre: 'Homemade' },
];

export const WORLD = {
  waterLevel: 0,
  half: 460,
  core: 320,
  flowSpeed: 0.55,
};

export const TOWN = {
  name: 'Gzowo Springs',
  x0: 256,
  x1: 414,
  z0: -71,
  z1: 71,
  ground: 4.28,
  street: 4.4,
  walk: 4.44,
};

export const LAYERS = {
  WORLD: 0,
  DETAIL: 1,
  WATER: 2,
};

export const BRIDGE = {
  halfLength: 48,
  deckY: 8.6,
  deckHalfWidth: 6.3,
  carriageHalfWidth: 4.5,
  sidewalkHeight: 0.18,
  pierXs: [-24, 0, 24],
  columnZ: 3.4,
  columnRadius: 0.7,
  gapX: [6, 12],
  gapSide: 1,
};

export const ROAD = {
  baseY: 4.4,
  halfWidth: 4.5,
  shoulder: 2.0,
  endX: 250,
  pullOff: { x0: -142, x1: -108, z0: 6.2, z1: 24 },
};

export const SPAWN = {
  car: { x: -116, z: 16.5, yaw: 0.12 },
  player: { x: -122.5, z: 12.4, yaw: 1.2 },
};

export const WATER_OBSTACLES = BRIDGE.pierXs.flatMap((x) => [
  { x, z: -BRIDGE.columnZ, radius: BRIDGE.columnRadius },
  { x, z: BRIDGE.columnZ, radius: BRIDGE.columnRadius },
]);
