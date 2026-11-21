// Costa del Gzowo: lazy Firebase loader with anonymous sign-in; the game stays single player when it cannot be reached.
import { firebaseConfig, NET } from './firebaseConfig.js';

let pending = null;

function timeout(promise, ms, label) {
  let timer = null;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

async function load() {
  const [appMod, authMod, db] = await timeout(Promise.all([import(`${NET.sdk}/firebase-app.js`), import(`${NET.sdk}/firebase-auth.js`), import(`${NET.sdk}/firebase-database.js`)]), 12000, 'Firebase SDK');
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const user = auth.currentUser || (await timeout(authMod.signInAnonymously(auth), 12000, 'Sign-in')).user;
  const database = db.getDatabase(app);
  let offset = 0;
  db.onValue(db.ref(database, '.info/serverTimeOffset'), (snap) => {
    offset = snap.val() || 0;
  });
  const token = Math.random().toString(36).slice(2, 10);
  return {
    db,
    database,
    uid: user.uid,
    pid: `${user.uid}:${token}`,
    ref: (path) => db.ref(database, path),
    now: () => Date.now() + offset,
  };
}

export function loadBackend() {
  if (!pending) {
    pending = load().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
