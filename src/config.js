// Costa del Gzowo: shared world constants (meters, Y up, river flows toward +Z, bridge runs along X at z = 0).

export const GAME = {
  title: 'Costa del Gzowo',
};

export const MUSIC = {
  title: {
    url: 'assets/music/love-is-a-long-road.mp3', title: 'Love Is a Long Road', artist: 'Tom Petty and the Heartbreakers',
    own: { url: 'assets/music-public/costa-sun-goes-down.mp3', title: 'Sun Goes Down', artist: 'Costa del Gzowo OST' },
  },
  menu: {
    url: 'assets/music/hot-together.mp3', title: 'Hot Together', artist: 'The Pointer Sisters',
    own: { url: 'assets/music-public/costa-miami-soul.mp3', title: 'Miami Soul', artist: 'Costa del Gzowo OST' },
  },
};

export const RADIO = [
  { id: 'springs', name: 'Springs Radio', frequency: '91.5', genre: 'Costa Originals' },
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
  car: { x: -113.5, z: 20.4, yaw: 0.12 },
  player: { x: -119.6, z: 21.6, yaw: 1.45 },
};

export const FLEET = [
  { id: 'convertible', x: -113.5, z: 20.4, yaw: 0.12 },
  { id: 'convertible', x: -113.5, z: 16.8, yaw: 0.12, color: 0x0c3f52, plate: 'GZW 27' },
  { id: 'roadster', x: -113.5, z: 13.2, yaw: 0.12 },
  { id: 'roadster', x: -113.5, z: 9.6, yaw: 0.12 },
  { id: 'heli', x: -127, z: 14, yaw: 0.12 },
  { id: 'heli', x: -138.5, z: 14, yaw: 0.12 },
  { id: 'cybertruck', x: -120.2, z: 7.9, yaw: 0.12 },
];

export const STATUES = [
  { id: 'default', x: -122.6, z: 23.3, yaw: Math.PI },
  { id: 'jurek', x: -125.0, z: 23.3, yaw: Math.PI },
];

export const WATER_OBSTACLES = BRIDGE.pierXs.flatMap((x) => [
  { x, z: -BRIDGE.columnZ, radius: BRIDGE.columnRadius },
  { x, z: BRIDGE.columnZ, radius: BRIDGE.columnRadius },
]);
