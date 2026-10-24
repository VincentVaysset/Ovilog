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

let authCourant = null;
// Session persistante (comme le vrai SDK avec browserLocalPersistence) : SEULEMENT si le test l'active (localStorage « __fakePersister » = '1'),
// pour retrouver au démarrage une session existante -- les autres tests gardent une connexion à chaque chargement.
const CLE_SESSION = '__fakeSessionAuth';
const persister = () => { try { return localStorage.getItem('__fakePersister') === '1'; } catch (e) { return false; } };
function memoriserSession(u) { if (!persister()) return; try { if (u) localStorage.setItem(CLE_SESSION, JSON.stringify({ uid: u.uid, email: u.email, emailVerified: u.emailVerified })); else localStorage.removeItem(CLE_SESSION); } catch (e) {} }
export function getAuth(app) {
  authCourant = { app, currentUser: null, _listeners: [] };
  if (persister()) { try { const m = JSON.parse(localStorage.getItem(CLE_SESSION) || 'null'); if (m) authCourant.currentUser = fauxUtilisateur(m.uid, m.email, m.emailVerified); } catch (e) {} }
  return authCourant;
}
// Utilisateur comme le vrai SDK : emailVerified, reload() (relit l'état serveur) et getIdToken(true) (le jeton ne porte la vérification qu'une fois rafraîchi).
function fauxUtilisateur(uid, email, emailVerified) {
  const u = { uid, email, emailVerified: !!emailVerified, _jetonVerifie: !!emailVerified, _rafraichissements: 0 };
  u.reload = async () => {
    if (reseau().coupe) { const e = new Error('network'); e.code = 'auth/network-request-failed'; throw e; }
    const r = await (await fetch(BACKEND_URL + '/auth/user?uid=' + uid)).json();
    u.emailVerified = !!r.emailVerified;
    memoriserSession(u);
  };
  u.getIdToken = async (force) => { if (force) { u._rafraichissements++; u._jetonVerifie = u.emailVerified; if (typeof window !== 'undefined') window.__fakeIdTokenForce = (window.__fakeIdTokenForce || 0) + 1; } return 'jeton-' + uid; };
  return u;
}
export async function sendEmailVerification(user) {
  if (reseau().coupe) { const e = new Error('network'); e.code = 'auth/network-request-failed'; throw e; }
  await fetch(BACKEND_URL + '/auth/sendVerification', { method: 'POST', body: JSON.stringify({ uid: user.uid }) });
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
  auth.currentUser = fauxUtilisateur(data.uid, email, data.emailVerified !== false);
  memoriserSession(auth.currentUser);
  fireAuthListeners(auth);
  return { user: auth.currentUser };
}
export async function signInWithEmailAndPassword(auth, email, password) {
  const res = await fetch(BACKEND_URL + '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.error); e.code = 'auth/' + data.error; throw e; }
  auth.currentUser = fauxUtilisateur(data.uid, email, data.emailVerified !== false);
  memoriserSession(auth.currentUser);
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
  memoriserSession(null);
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
  const jetonVerifie = authCourant && authCourant.currentUser ? authCourant.currentUser._jetonVerifie !== false : true;
  const authUid = authCourant && authCourant.currentUser ? authCourant.currentUser.uid : null;
  try { return await fetch(BACKEND_URL + '/batch', { method: 'POST', body: JSON.stringify(Object.assign({ clientId: clientId(), jetonVerifie, authUid }, body)) }); }
  finally { ecrituresTerminees++; }
}

function parsePath(path) {
  const parts = path.split('/');
  if (parts[0] !== 'users') return { racine: parts[0], id: parts[1] };   // collection à la racine (bulle de contact : feedback, admins)
  return { uid: parts[1], col: parts[2], id: parts[3] };
}
const authUidCourant = () => (authCourant && authCourant.currentUser ? authCourant.currentUser.uid : '');

// Collections à la racine (feedback) : comme le vrai SDK, une écriture apparaît TOUT DE SUITE dans les instantanés de cet appareil avec
// metadata.hasPendingWrites = true (même hors réseau), puis disparaît si le serveur la refuse (règles : permission-denied, promesse rejetée).
const enAttenteRacine = new Map();   // chemin -> { type, data }
let versionLocaleRacine = 0;
async function ecrireRacine(op) {
  enAttenteRacine.set(op.path, op); versionLocaleRacine++;
  try {
    const res = await ecrire({ uid: null, ops: [op] });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const e = new Error(data.message || data.error || ('HTTP ' + res.status)); e.code = data.error || 'unknown';
      throw e;
    }
  } finally { if (enAttenteRacine.get(op.path) === op) enAttenteRacine.delete(op.path); versionLocaleRacine++; }
}
export function query(colRef, ...filtres) { return { path: colRef.path, filtres }; }
export function where(champ, op, valeur) { return { champ, op, valeur }; }
export function serverTimestamp() { return { __op: 'serverTimestamp' }; }

export async function setDoc(ref, data) {
  const p = parsePath(ref.path);
  if (p.racine) return ecrireRacine({ type: 'set', path: ref.path, data });
  await ecrire({ uid: p.uid, ops: [{ type: 'set', path: ref.path, data }] });
}
export async function updateDoc(ref, data) {
  const p = parsePath(ref.path);
  if (p.racine) return ecrireRacine({ type: 'update', path: ref.path, data });
  await ecrire({ uid: p.uid, ops: [{ type: 'update', path: ref.path, data }] });
}
export async function deleteDoc(ref) {
  const p = parsePath(ref.path);
  if (p.racine) return ecrireRacine({ type: 'delete', path: ref.path });
  await ecrire({ uid: p.uid, ops: [{ type: 'delete', path: ref.path }] });
}
export async function getDoc(ref) {
  const pr = parsePath(ref.path);
  if (pr.racine) {
    const res = await lireServeur(BACKEND_URL + '/getdoc?racine=' + pr.racine + '&id=' + encodeURIComponent(pr.id) + '&auth=' + authUidCourant());
    const data = await res.json();
    if (!res.ok) { const e = new Error(data.error); e.code = data.error; throw e; }
    return { exists: () => data.exists, data: () => data.data };
  }
  const { uid, col, id } = pr;
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
  if (parsePath(ref.path).racine) return onSnapshotRacine(ref, options, onNext, onError);
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


// Instantanés d'une collection à la racine (ou d'une requête where('champ', '==', valeur)) : contenu serveur + écritures locales en attente.
function onSnapshotRacine(ref, options, onNext, onError) {
  const racine = ref.path.split('/')[0];
  const f = (ref.filtres || [])[0];
  let dernier = null, stopped = false, serveur = null;
  function livrer() {
    const docs = Object.assign({}, serveur || {});
    const pendants = new Set();
    enAttenteRacine.forEach((op, path) => {
      const [col, id] = path.split('/');
      if (col !== racine) return;
      if (op.type === 'delete') { delete docs[id]; return; }
      const base = op.type === 'update' ? Object.assign({}, docs[id] || {}) : {};
      Object.keys(op.data).forEach(k => { const v = op.data[k]; base[k] = v && v.__op === 'serverTimestamp' ? Date.now() : v; });
      docs[id] = base; pendants.add(id);
    });
    Object.keys(docs).forEach(id => { if (f && docs[id][f.champ] !== f.valeur) delete docs[id]; });
    const signature = JSON.stringify([docs, [...pendants].sort()]);
    const metaSeule = signature === dernier;
    if (metaSeule) return;
    dernier = signature;
    const liste = Object.keys(docs).map(id => ({ id, data: () => docs[id], metadata: { hasPendingWrites: pendants.has(id), fromCache: false } }));
    onNext({ forEach(fn) { liste.forEach(fn); }, size: liste.length, metadata: { hasPendingWrites: pendants.size > 0, fromCache: reseau().coupe === true } });
  }
  async function poll() {
    if (stopped) return;
    try {
      if (!reseau().coupe) {
        const q = f ? '&champ=' + encodeURIComponent(f.champ) + '&valeur=' + encodeURIComponent(f.valeur) : '';
        const res = await lireServeur(BACKEND_URL + '/snapshot?racine=' + racine + '&auth=' + authUidCourant() + q);
        const data = await res.json();
        if (!res.ok) { const e = new Error(data.error); e.code = data.error; throw e; }
        serveur = data.docs;
      }
      livrer();
    } catch (e) {
      if (e && e.code === 'unavailable') { /* réseau coupé pendant le vol */ }
      else { if (onError) onError(e); stopped = true; return; }
    }
    if (!stopped) setTimeout(poll, POLL_MS);
  }
  poll();
  return () => { stopped = true; };
}
