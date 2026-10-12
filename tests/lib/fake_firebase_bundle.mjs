/* Faux module remplaçant www/vendor/firebase.bundle.js pour les tests --
   voir fake_firebase_backend.mjs. Sert de loopback local (BACKEND_URL),
   jamais le vrai SDK Firebase : les fonctions exportées ont exactement les
   mêmes signatures que celles importées par www/index.html, pour tester le
   VRAI code applicatif (syncAllToCloud/writeBatch/onSnapshot) sans réseau
   externe. */
const BACKEND_URL = 'http://127.0.0.1:__FAKE_FIREBASE_PORT__';

export function initializeApp(config) { return { config }; }
export function initializeFirestore(app, opts) { return { app }; }
export function persistentLocalCache(opts) { return {}; }
export function persistentSingleTabManager() { return {}; }

export function getAuth(app) {
  return { app, currentUser: null, _listeners: [] };
}
export async function setPersistence(auth, mode) { /* no-op */ }
export const browserLocalPersistence = 'local';

function fireAuthListeners(auth) {
  auth._listeners.forEach(cb => cb(auth.currentUser));
}
export async function createUserWithEmailAndPassword(auth, email, password) {
  const res = await fetch(BACKEND_URL + '/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.error); e.code = 'auth/' + data.error; throw e; }
  auth.currentUser = { uid: data.uid, email };
  fireAuthListeners(auth);
  return { user: auth.currentUser };
}
export async function signInWithEmailAndPassword(auth, email, password) {
  const res = await fetch(BACKEND_URL + '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.error); e.code = 'auth/' + data.error; throw e; }
  auth.currentUser = { uid: data.uid, email };
  fireAuthListeners(auth);
  return { user: auth.currentUser };
}
export async function sendPasswordResetEmail(auth, email) { /* no-op */ }
export function onAuthStateChanged(auth, cb) {
  auth._listeners.push(cb);
  cb(auth.currentUser); // même comportement que le vrai SDK : appel immédiat avec l'état courant
  return () => { auth._listeners = auth._listeners.filter(x => x !== cb); };
}
export async function signOut(auth) {
  auth.currentUser = null;
  fireAuthListeners(auth);
}

export function collection(db, ...segments) { return { path: segments.join('/') }; }
export function doc(refOrDb, ...segments) {
  const base = refOrDb && refOrDb.path ? refOrDb.path : '';
  const path = [base, ...segments].filter(Boolean).join('/');
  return { path };
}

function parsePath(path) {
  const parts = path.split('/');
  return { uid: parts[1], col: parts[2], id: parts[3] };
}

export async function setDoc(ref, data) {
  const { uid } = parsePath(ref.path);
  await fetch(BACKEND_URL + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops: [{ type: 'set', path: ref.path, data }] }) });
}
export async function updateDoc(ref, data) {
  const { uid } = parsePath(ref.path);
  await fetch(BACKEND_URL + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops: [{ type: 'update', path: ref.path, data }] }) });
}
export async function deleteDoc(ref) {
  const { uid } = parsePath(ref.path);
  await fetch(BACKEND_URL + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops: [{ type: 'delete', path: ref.path }] }) });
}
export async function getDoc(ref) {
  const { uid, col, id } = parsePath(ref.path);
  const res = await fetch(BACKEND_URL + '/getdoc?uid=' + uid + '&col=' + col + '&id=' + (id || ''));
  const data = await res.json();
  return { exists: () => data.exists, data: () => data.data };
}
// getDocs (collection entière, pas un doc unique) -- ajouté pour tester la
// migration du registre (voir migrerRegistreVersCollection dans index.html,
// qui interroge la collection avant d'écrire pour ne jamais recréer un
// document déjà présent).
export async function getDocs(colRef) {
  const { uid, col } = parsePath(colRef.path);
  const res = await fetch(BACKEND_URL + '/snapshot?uid=' + uid + '&col=' + col);
  const data = await res.json();
  const entries = Object.keys(data.docs || {});
  return { forEach(fn) { entries.forEach(id => fn({ id, data: () => data.docs[id] })); } };
}
export function arrayUnion(...values) { return { __op: 'arrayUnion', values }; }

export function writeBatch(db) {
  const ops = [];
  let uid = null;
  return {
    set(ref, data) { uid = uid || parsePath(ref.path).uid; ops.push({ type: 'set', path: ref.path, data }); },
    update(ref, data) { uid = uid || parsePath(ref.path).uid; ops.push({ type: 'update', path: ref.path, data }); },
    delete(ref) { uid = uid || parsePath(ref.path).uid; ops.push({ type: 'delete', path: ref.path }); },
    async commit() {
      window.__testBatchCallCount = (window.__testBatchCallCount || 0) + 1;
      window.__testBatchOpsCount = (window.__testBatchOpsCount || 0) + ops.length;
      const res = await fetch(BACKEND_URL + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops }) });
      if (!res.ok) {
        // Même contrat que le vrai SDK : commit() rejette sa promesse si le
        // batch échoue (ex: update() sur un document supprimé -- voir la
        // précondition ajoutée dans fake_firebase_backend.mjs), TOUT le
        // batch est rejeté, jamais seulement l'opération fautive.
        const data = await res.json().catch(() => ({}));
        const e = new Error(data.message || data.error || ('batch commit failed, HTTP ' + res.status));
        e.code = data.error || 'unknown';
        throw e;
      }
    }
  };
}

// onSnapshot -- par polling (pas de vrai canal temps réel ici, voir
// l'en-tête du fichier), suffisant pour tester la logique applicative.
const POLL_MS = 120;
export function onSnapshot(ref, onNext, onError) {
  const { uid, col, id } = parsePath(ref.path);
  let lastVersion = -1;
  let stopped = false;
  async function poll() {
    if (stopped) return;
    try {
      if (col === 'meta' && id) {
        // doc unique (meta/main) : traité comme la collection 'meta' côté backend
        const res = await fetch(BACKEND_URL + '/snapshot?uid=' + uid + '&col=meta');
        const data = await res.json();
        if (data.version !== lastVersion) {
          lastVersion = data.version;
          onNext({ exists: () => data.exists, data: () => data.data });
        }
      } else {
        const res = await fetch(BACKEND_URL + '/snapshot?uid=' + uid + '&col=' + col);
        const data = await res.json();
        if (data.version !== lastVersion) {
          lastVersion = data.version;
          const docs = Object.keys(data.docs).map(k => data.docs[k]);
          onNext({ forEach(fn) { docs.forEach(d => fn({ data: () => d })); } });
        }
      }
    } catch (e) {
      if (onError) onError(e);
    }
    if (!stopped) setTimeout(poll, POLL_MS);
  }
  poll();
  return () => { stopped = true; };
}
