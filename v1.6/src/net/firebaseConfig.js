// Costa del Gzowo: public Firebase web config of the shared gzowos-games project (multiplayer data lives under the costa branch, protected by database rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyAaTuELH_mToxH3hRJ4WPIVTECSH7Z8-FY',
  authDomain: 'gzowos-games.firebaseapp.com',
  databaseURL: 'https://gzowos-games-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'gzowos-games',
  storageBucket: 'gzowos-games.firebasestorage.app',
  messagingSenderId: '658227201482',
  appId: '1:658227201482:web:627b44e3c4c2988bc4bb33',
};

export const NET = {
  root: 'costa',
  worlds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'],
  maxPlayers: 4,
  staleMs: 45000,
  heartbeatMs: 15000,
  sendHz: 15,
  relayHz: 5,
  relayAfterMs: 8000,
  delayMs: 110,
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
  sdk: 'https://www.gstatic.com/firebasejs/10.12.5',
};
