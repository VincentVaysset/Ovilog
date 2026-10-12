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

// Réseau simulé, pilotable PAR PAGE depuis un test : window.__fakeReseau = { coupe: bool, delaiLectureMs: n }.
//  - coupe : plus aucun accès serveur ; les lectures ponctuelles (getDoc/getDocs) échouent comme le vrai SDK hors ligne, onSnapshot ne livre
//    que le CACHE (vide si cet appareil n'a jamais rien lu, snapshot.metadata.fromCache === true) et les écritures sont MISES EN FILE : elles
//    ne partent qu'au retour du réseau, exactement comme le vrai SDK (c'est ce qui rend dangereuse une écriture de valeurs par défaut).
//  - delaiLectureMs : réseau lent, chaque lecture serveur n'aboutit qu'après ce délai.
const reseau = () => (typeof window !== 'undefined' && window.__fakeReseau) || {};
const dormir = ms => new Promise(r => setTimeout(r, ms));
if (typeof window !== 'undefined') window.__fakeClientId = window.__fakeClientId || ('c' + Math.random().toString(36).slice(2, 8));
const clientId = () => (typeof window !== 'undefined' ? window.__fakeClientId : null);
async function attendreReseau() { while (reseau().coupe) await dormir(40); }
async function lireServeur(url) {
  if (reseau().coupe) { const e = new Error('Failed to get document because the client is offline.'); e.code = 'unavailable'; throw e; }
  if (reseau().delaiLectureMs) await dormir(reseau().delaiLectureMs);
  if (reseau().coupe) { const e = new Error('Failed to get document because the client is offline.'); e.code = 'unavailable'; throw e; }
  return fetch(url);
}

// Compteur d'écritures terminées (ack reçu) : onSnapshot jette toute réponse
// de polling dont le vol a chevauché une écriture, puis relance aussitôt.
// Sinon un instantané pris AVANT l'écriture pourrait être livré APRÈS son ack
// (état périmé que le vrai SDK ne livre jamais).
let ecrituresTerminees = 0;
async function ecrire(body) {
  await attendreReseau();
  // Trace côté page (heure d'ENVOI réel, après la file hors ligne) : les tests y comparent l'ordre « sauvegarde puis écriture ».
  if (typeof window !== 'undefined') (window.__ecrituresLog = window.__ecrituresLog || []).push({ t: performance.now(), chemins: (body.ops || []).map(o => o.path), pile: (body.ops || []).some(o => o.path.includes('/registre/')) ? String(new Error().stack).split('\n').slice(2, 9).map(l => l.trim().replace(/^at /, '').slice(0, 90)).join(' < ') : undefined });
  try { return await fetch(BACKEND_URL + '/batch', { method: 'POST', body: JSON.stringify(Object.assign({ clientId: clientId() }, body)) }); }
  finally { ecrituresTerminees++; }
}

function parsePath(path) {
  const parts = path.split('/');
  return { uid: parts[1], col: parts[2], id: parts[3] };
}

export async function setDoc(ref, data) {
  const { uid } = parsePath(ref.path);
  await ecrire({ uid, ops: [{ type: 'set', path: ref.path, data }] });
}
export async function updateDoc(ref, data) {
  const { uid } = parsePath(ref.path);
  await ecrire({ uid, ops: [{ type: 'update', path: ref.path, data }] });
}
export async function deleteDoc(ref) {
  const { uid } = parsePath(ref.path);
  await ecrire({ uid, ops: [{ type: 'delete', path: ref.path }] });
}
export async function getDoc(ref) {
  const { uid, col, id } = parsePath(ref.path);
  const res = await lireServeur(BACKEND_URL + '/getdoc?uid=' + uid + '&col=' + col + '&id=' + (id || ''));
  const data = await res.json();
  return { exists: () => data.exists, data: () => data.data };
}
// getDocs (collection entière, pas un doc unique) -- ajouté pour tester la
// migration du registre (voir migrerRegistreVersCollection dans index.html,
// qui interroge la collection avant d'écrire pour ne jamais recréer un
// document déjà présent).
export async function getDocs(colRef) {
  const { uid, col } = parsePath(colRef.path);
  const res = await lireServeur(BACKEND_URL + '/snapshot?uid=' + uid + '&col=' + col);
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
      const res = await ecrire({ uid, ops });
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

// runTransaction -- seul usage voulu : « créer seulement si absent » (initialisation d'un compte vide). Même contrat que le vrai SDK : la fonction est
// rejouée si la transaction est abandonnée parce qu'un autre appareil a créé le document entre-temps (409 du faux backend).
export async function runTransaction(db, fn) {
  for (let essai = 0; essai < 5; essai++) {
    const lus = [];
    const ecritures = [];
    const tx = {
      async get(ref) { const snap = await getDoc(ref); lus.push({ path: ref.path, existe: snap.exists() }); return snap; },
      set(ref, data) { ecritures.push({ type: 'set', path: ref.path, data }); return tx; },
      update(ref, data) { ecritures.push({ type: 'update', path: ref.path, data }); return tx; },
      delete(ref) { ecritures.push({ type: 'delete', path: ref.path }); return tx; }
    };
    const resultat = await fn(tx);
    if (!ecritures.length) return resultat;
    const ops = ecritures.map(op => Object.assign({}, op, { onlyIfAbsent: op.type === 'set' && lus.some(l => l.path === op.path && !l.existe) }));
    const res = await ecrire({ uid: parsePath(ops[0].path).uid, ops });
    if (res.ok) return resultat;
    if (res.status === 409) continue;
    const data = await res.json().catch(() => ({}));
    const e = new Error(data.message || data.error || ('transaction failed, HTTP ' + res.status));
    e.code = data.error || 'unknown';
    throw e;
  }
  const e = new Error('Transaction abandonnée après plusieurs tentatives'); e.code = 'aborted'; throw e;
}

// onSnapshot -- par polling (pas de vrai canal temps réel ici, voir
// l'en-tête du fichier), suffisant pour tester la logique applicative.
// Contrat du vrai SDK reproduit : signature (ref, [options,] onNext, onError) ; snapshot.metadata.fromCache ; sans includeMetadataChanges, un
// changement de métadonnées seul (cache -> serveur, contenu identique) n'appelle PAS le rappel.
const POLL_MS = 120;
const cacheLocal = new Map(); // « cache persistant » de cet appareil : dernier contenu serveur vu, par chemin
export function onSnapshot(ref, a, b, c) {
  const options = typeof a === 'function' ? {} : (a || {});
  const onNext = typeof a === 'function' ? a : b;
  const onError = typeof a === 'function' ? b : c;
  const { uid, col, id } = parsePath(ref.path);
  const estMeta = col === 'meta' && !!id;
  let lastVersion = -1;
  let dernierDuCache = null;
  let stopped = false;
  function livrer(data, fromCache) {
    const metadata = { fromCache, hasPendingWrites: false };
    if (estMeta && typeof window !== 'undefined') (window.__metaLog = window.__metaLog || []).push({ t: Math.round(performance.now()), cache: fromCache, existe: data.exists, drapeau: data.data && data.data.registreCollectionMigree20260930, nReg: data.data && data.data.registre ? Object.keys(data.data.registre.brebis || {}).length : null });
    if (estMeta) onNext({ exists: () => data.exists, data: () => data.data, metadata });
    else {
      const docs = Object.keys(data.docs || {}).map(k => data.docs[k]);
      onNext({ forEach(fn) { docs.forEach(d => fn({ data: () => d })); }, metadata });
    }
  }
  async function relancer() { await dormir(20); return poll(); }
  async function poll() {
    if (stopped) return;
    const ecritures = ecrituresTerminees;
    try {
      if (reseau().coupe) {
        if (dernierDuCache !== true) {
          dernierDuCache = true;
          livrer(cacheLocal.get(ref.path) || (estMeta ? { exists: false, data: null } : { docs: {} }), true);
        }
      } else {
        const res = await lireServeur(BACKEND_URL + '/snapshot?uid=' + uid + '&col=' + (estMeta ? 'meta' : col));
        const data = await res.json();
        if (ecrituresTerminees !== ecritures) return poll(); // écriture terminée pendant le vol : réponse périmée, on relance aussitôt
        if (data.version !== lastVersion || (dernierDuCache === true && options.includeMetadataChanges)) {
          lastVersion = data.version;
          dernierDuCache = false;
          cacheLocal.set(ref.path, data);
          livrer(data, false);
        }
      }
    } catch (e) {
      if (e && e.code === 'unavailable') { /* réseau coupé pendant le vol : le prochain tour livrera le cache */ }
      else if (onError) onError(e);
    }
    if (!stopped) setTimeout(poll, POLL_MS);
  }
  poll();
  return () => { stopped = true; };
}
