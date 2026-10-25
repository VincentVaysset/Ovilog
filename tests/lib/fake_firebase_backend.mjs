/* Faux backend Firestore/Auth en mémoire, pour tester le VRAI code de synchro
   de index.html (writeBatch groupé, arrayUnion, onSnapshot) sans dépendre du
   réseau externe -- le proxy de ce bac à sable ne supporte pas le canal
   temps réel de Firestore (voir /root/.ccr/README.md : "gRPC / HTTP/2-only
   APIs" / "WebSocket upgrades" non supportés). Tourne en local (loopback),
   atteignable depuis Chromium sans passer par le proxy. Ne réimplémente que
   ce dont www/index.html a besoin : setDoc/updateDoc/deleteDoc regroupés en
   writeBatch, arrayUnion (merge de tableau), onSnapshot par polling. */
import http from 'http';
import { randomUUID } from 'crypto';

const users = new Map(); // email -> { uid, password, verifie, envois }
// Vérification de l'adresse e-mail (test_verification_email) : désactivée par défaut, tout compte est alors vérifié (les autres tests n'en voient rien).
let exigerVerification = false;
// « Règles non publiées » (test_bulle_contact) : toute écriture de l'appli dans feedback est refusée, comme avant la publication des règles dans la console
let refuserFeedback = false;
const userParUid = uid => [...users.values()].find(u => u.uid === uid);
const collections = new Map(); // uid -> { colName -> { docId -> data } }
const metas = new Map(); // uid -> data
const journaux = new Map(); // uid -> [{ n, clientId, ops: [{ type, path, lots? }] }] : toutes les écritures REÇUES, dans l'ordre (les tests y vérifient qui a écrit quoi, et quand)
const versions = new Map(); // uid -> { colName|'meta' -> integer, bumped on every write }
// Collections à la racine (bulle de contact) : feedback/{id}, admins/{uid} -- avec les MÊMES règles que firestore.rules (connecte, estAdmin, champs permis).
const racines = new Map(); // col -> { id -> data }
const racine = col => { if (!racines.has(col)) racines.set(col, {}); return racines.get(col); };
const CHAMPS_FEEDBACK = ['uid', 'exploitation', 'texte', 'type', 'date', 'dateServeur', 'campagne', 'ecran', 'version', 'appareil', 'statut', 'reponse', 'reponseDate', 'reponseLue'];
const estAdmin = uid => !!uid && racine('admins')[uid] !== undefined;
function resoudreSentinelles(data) { const r = {}; Object.keys(data || {}).forEach(k => { const v = data[k]; r[k] = v && v.__op === 'serverTimestamp' ? { __serverTime: true, ms: Date.now() } : v; }); return r; }
// Rapports d'erreurs automatiques : MÊMES règles que firestore.rules (création seule, champs fermés, typés et bornés ; ni modification ni suppression par l'appli)
const CHAMPS_ERREUR = ['uid', 'date', 'version', 'appareil', 'ecran', 'type', 'message', 'pile', 'nombre'];
function refusErreur(op, auth, id) {
  if (op.type === 'delete') return estAdmin(auth) ? null : 'suppression réservée à l\'administrateur';
  if (op.type !== 'set' || racine('erreurs')[id] !== undefined) return 'un rapport ne se modifie pas';
  const d = op.data || {}, cles = Object.keys(d);
  if (!id.startsWith(auth + '_')) return 'identifiant';
  if (!cles.every(k => CHAMPS_ERREUR.includes(k)) || !CHAMPS_ERREUR.every(k => cles.includes(k))) return 'champs';
  const chaine = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
  if (d.uid !== auth || !chaine(d.date, 30) || !chaine(d.version, 20) || !['android', 'pc'].includes(d.appareil) || !chaine(d.ecran, 60) || !chaine(d.type, 60, 1) || !chaine(d.message, 300)) return 'champ invalide';
  if (!Array.isArray(d.pile) || d.pile.length > 5 || !d.pile.every(l => chaine(l, 200))) return 'pile';
  if (!Number.isInteger(d.nombre) || d.nombre < 1 || d.nombre > 1000) return 'nombre';
  return null;
}
// Renvoie null si l'opération est permise, sinon le motif du refus (permission-denied)
function refusRacine(op, auth) {
  const [col, id] = op.path.split('/');
  if (!auth) return 'non connecté';
  if (col === 'admins') return 'admins : écriture réservée à la console';
  if (col === 'erreurs') return refusErreur(op, auth, id);
  if (col !== 'feedback') return 'collection inconnue';
  if (refuserFeedback) return 'règles non publiées';
  const actuel = racine('feedback')[id];
  if (op.type === 'set') {
    if (actuel !== undefined) return 'mise à jour par set';
    const d = op.data || {}, cles = Object.keys(d);
    if (!id.startsWith(auth + '_') || id.length <= auth.length + 1) return 'identifiant';
    if (!cles.every(k => CHAMPS_FEEDBACK.includes(k))) return 'champ non permis : ' + cles.filter(k => !CHAMPS_FEEDBACK.includes(k)).join(',');
    if (!['uid', 'texte', 'type', 'date', 'statut'].every(k => cles.includes(k))) return 'champ manquant';
    if (d.uid !== auth) return 'uid';
    if (typeof d.texte !== 'string' || !d.texte.length || d.texte.length > 2000) return 'texte';
    if (!['bug', 'question', 'idee'].includes(d.type)) return 'type';
    if (d.statut !== 'nouveau') return 'statut';
    if ((d.reponse || '') !== '') return 'reponse';
    if ('dateServeur' in d && !(d.dateServeur && d.dateServeur.__op === 'serverTimestamp')) return 'dateServeur';
    return null;
  }
  if (actuel === undefined) return 'document absent';
  if (op.type === 'delete') return estAdmin(auth) ? null : 'suppression réservée à l\'administrateur';
  if (op.type === 'update') {
    const cles = Object.keys(op.data || {}).filter(k => JSON.stringify(op.data[k]) !== JSON.stringify(actuel[k]));
    const apres = Object.assign({}, actuel, op.data);
    if (estAdmin(auth) && cles.every(k => ['statut', 'reponse', 'reponseDate', 'reponseLue'].includes(k)) && ['nouveau', 'lu', 'traite'].includes(apres.statut) && typeof apres.reponse === 'string' && apres.reponse.length <= 2000) return null;
    if (actuel.uid === auth && cles.every(k => k === 'reponseLue') && apres.reponseLue === true) return null;
    return 'mise à jour non permise : ' + cles.join(',');
  }
  return 'opération inconnue';
}

function ensureUser(uid) {
  if (!collections.has(uid)) collections.set(uid, {});
  if (!versions.has(uid)) versions.set(uid, {});
}
function bumpVersion(uid, key) {
  const v = versions.get(uid);
  v[key] = (v[key] || 0) + 1;
}
function applyArrayUnionIfNeeded(existingVal, incomingVal) {
  if (incomingVal && typeof incomingVal === 'object' && incomingVal.__op === 'arrayUnion') {
    const base = Array.isArray(existingVal) ? existingVal.slice() : [];
    incomingVal.values.forEach(v => {
      if (!base.some(b => JSON.stringify(b) === JSON.stringify(v))) base.push(v);
    });
    return base;
  }
  return incomingVal;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

function parsePath(path) {
  // users/{uid}/{colOrMeta}/{id}
  const parts = path.split('/');
  return { uid: parts[1], colName: parts[2], id: parts[3] };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/auth/signup' && req.method === 'POST') {
      const { email, password } = await readBody(req);
      if (users.has(email)) return json(res, 400, { error: 'email-already-in-use' });
      const uid = randomUUID();
      users.set(email, { uid, password, verifie: !exigerVerification, envois: 0 });
      ensureUser(uid);
      return json(res, 200, { uid, emailVerified: !exigerVerification });
    }
    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const { email, password } = await readBody(req);
      const u = users.get(email);
      if (!u || u.password !== password) return json(res, 400, { error: 'invalid-credential' });
      ensureUser(u.uid);
      return json(res, 200, { uid: u.uid, emailVerified: u.verifie !== false });
    }
    if (url.pathname === '/racine/config' && req.method === 'POST') { refuserFeedback = !!(await readBody(req)).refuserFeedback; return json(res, 200, { ok: true }); }
    if (url.pathname === '/auth/config' && req.method === 'POST') { exigerVerification = !!(await readBody(req)).exigerVerification; return json(res, 200, { ok: true }); }
    if (url.pathname === '/auth/verifier' && req.method === 'POST') { const u = users.get((await readBody(req)).email); if (u) u.verifie = true; return json(res, u ? 200 : 404, { ok: !!u }); }
    if (url.pathname === '/auth/sendVerification' && req.method === 'POST') { const u = userParUid((await readBody(req)).uid); if (u) u.envois++; return json(res, u ? 200 : 404, { ok: !!u }); }
    if (url.pathname === '/auth/user' && req.method === 'GET') { const u = userParUid(url.searchParams.get('uid')); return json(res, u ? 200 : 404, u ? { emailVerified: u.verifie !== false, envois: u.envois } : { error: 'user-not-found' }); }
    if (url.pathname === '/batch' && req.method === 'POST') {
      const { uid, ops, clientId, jetonVerifie, authUid } = await readBody(req);
      // Collections à la racine : règles de la bulle de contact (le test peut écrire directement, clientId « test-direct », comme la console)
      if (ops.some(op => !op.path.startsWith('users/'))) {
        if (clientId !== 'test-direct') for (const op of ops) { const motif = refusRacine(op, authUid); if (motif) return json(res, 403, { error: 'permission-denied', message: motif }); }
        for (const op of ops) {
          const [col, id] = op.path.split('/');
          const c = racine(col);
          if (op.type === 'set') c[id] = resoudreSentinelles(op.data);
          else if (op.type === 'update') c[id] = Object.assign({}, c[id] || {}, resoudreSentinelles(op.data));
          else if (op.type === 'delete') delete c[id];
          if (!journaux.has('racine')) journaux.set('racine', []);
          journaux.get('racine').push({ n: journaux.get('racine').length + 1, clientId: clientId || null, ops: [{ type: op.type, path: op.path, data: op.data }] });
        }
        return json(res, 200, { ok: true });
      }
      // Règle Firestore « email_verified == true » : un jeton non vérifié ne peut rien écrire (permission-denied)
      if (exigerVerification && jetonVerifie === false) return json(res, 403, { error: 'permission-denied', message: 'email non vérifié dans le jeton' });
      ensureUser(uid);
      const cols = collections.get(uid);
      // « Créer seulement si absent » (runTransaction du faux SDK) : refuse TOUT le batch si le document existe déjà -- 409, comme une transaction abandonnée.
      for (const op of ops) {
        if (!op.onlyIfAbsent) continue;
        const { colName, id } = parsePath(op.path);
        const existe = colName === 'meta' ? metas.has(uid) : !!(cols[colName] && cols[colName][id] !== undefined);
        if (existe) return json(res, 409, { error: 'already-exists', message: 'Document déjà présent : ' + op.path });
      }
      // Précondition Firestore réelle (confirmée à l'utilisateur avant codage
      // du correctif audit "Changement de campagne", point 1 de la 3e
      // demande) : update() sur un document qui n'existe plus échoue, et fait
      // échouer TOUT le batch -- validé AVANT toute application, pour rester
      // atomique comme le vrai writeBatch.commit().
      for (const op of ops) {
        const { colName, id } = parsePath(op.path);
        if (op.type === 'update' && colName !== 'meta') {
          if (!cols[colName] || cols[colName][id] === undefined) {
            return json(res, 400, { error: 'not-found', message: 'No document to update: ' + op.path });
          }
        }
      }
      // Plafond Firestore réel : un document de plus de 1 048 576 octets est refusé (invalid-argument), TOUT le batch avec (test_taille_meta).
      // Taille approchée par le JSON du document obtenu : suffisant pour simuler le refus, l'appli mesure de son côté avec la règle exacte.
      for (const op of ops) {
        const { colName } = parsePath(op.path);
        if (colName !== 'meta' || op.type === 'delete') continue;
        const current = metas.get(uid) || {};
        const apres = op.type === 'set' ? op.data : Object.assign({}, current, op.data);
        const taille = Buffer.byteLength(JSON.stringify(apres));
        if (taille > 1048576) return json(res, 400, { error: 'invalid-argument', message: 'Document "' + op.path + '" cannot be written because its size (' + taille.toLocaleString('en-US') + ' bytes) exceeds the maximum allowed size of 1,048,576 bytes.' });
      }
      const touched = new Set();
      for (const op of ops) {
        const { uid: u2, colName, id } = parsePath(op.path);
        if (colName === 'meta') {
          const current = metas.get(uid) || {};
          if (op.type === 'set') { metas.set(uid, op.data); }
          else if (op.type === 'update') {
            const merged = Object.assign({}, current);
            Object.keys(op.data).forEach(k => { merged[k] = applyArrayUnionIfNeeded(current[k], op.data[k]); });
            metas.set(uid, merged);
          } else if (op.type === 'delete') { metas.delete(uid); }
          touched.add('meta');
          continue;
        }
        if (!cols[colName]) cols[colName] = {};
        if (op.type === 'set') {
          cols[colName][id] = op.data;
        } else if (op.type === 'update') {
          const current = cols[colName][id] || {};
          const merged = Object.assign({}, current);
          Object.keys(op.data).forEach(k => { merged[k] = applyArrayUnionIfNeeded(current[k], op.data[k]); });
          cols[colName][id] = merged;
        } else if (op.type === 'delete') {
          delete cols[colName][id];
        }
        touched.add(colName);
      }
      touched.forEach(k => bumpVersion(uid, k));
      if (!journaux.has(uid)) journaux.set(uid, []);
      const jr = journaux.get(uid);
      jr.push({ n: jr.length + 1, clientId: clientId || null, ops: ops.map(op => {
        const e = { type: op.type, path: op.path };
        if (op.data && Array.isArray(op.data.lots)) e.lots = op.data.lots.map(l => l && l.id);
        if (op.data && 'registreCollectionMigree20260930' in op.data) e.drapeauMigration = op.data.registreCollectionMigree20260930;
        return e;
      }) });
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/journal' && req.method === 'GET') {
      return json(res, 200, journaux.get(url.searchParams.get('uid')) || []);
    }
    if (url.pathname === '/getdoc' && req.method === 'GET' && url.searchParams.get('racine')) {
      const col = url.searchParams.get('racine'), id = url.searchParams.get('id'), auth = url.searchParams.get('auth');
      if (col === 'admins' && (!auth || auth !== id)) return json(res, 403, { error: 'permission-denied' });
      const data = racine(col)[id];
      return json(res, 200, { exists: data !== undefined, data: data || null });
    }
    if (url.pathname === '/snapshot' && req.method === 'GET' && url.searchParams.get('racine')) {
      const col = url.searchParams.get('racine'), auth = url.searchParams.get('auth'), champ = url.searchParams.get('champ'), valeur = url.searchParams.get('valeur');
      if (url.searchParams.get('test') !== '1') {
        const permis = (col === 'feedback' && auth && (estAdmin(auth) || (champ === 'uid' && valeur === auth))) || (col === 'erreurs' && estAdmin(auth));
        if (!permis) return json(res, 403, { error: 'permission-denied' });
      }
      const tous = racine(col), docs = {};
      Object.keys(tous).forEach(id => { if (!champ || tous[id][champ] === valeur) docs[id] = tous[id]; });
      return json(res, 200, { docs });
    }
    if (url.pathname === '/getdoc' && req.method === 'GET') {
      const uid = url.searchParams.get('uid');
      const colName = url.searchParams.get('col');
      const id = url.searchParams.get('id');
      ensureUser(uid);
      if (colName === 'meta') {
        const data = metas.get(uid);
        return json(res, 200, { exists: data !== undefined, data: data || null });
      }
      const cols = collections.get(uid);
      const data = (cols[colName] || {})[id];
      return json(res, 200, { exists: data !== undefined, data: data || null });
    }
    if (url.pathname === '/snapshot' && req.method === 'GET') {
      const uid = url.searchParams.get('uid');
      const colName = url.searchParams.get('col');
      ensureUser(uid);
      const v = (versions.get(uid) || {})[colName] || 0;
      if (colName === 'meta') {
        return json(res, 200, { version: v, exists: metas.has(uid), data: metas.get(uid) || null });
      }
      const cols = collections.get(uid);
      return json(res, 200, { version: v, docs: cols[colName] || {} });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
});

const port = process.env.FAKE_FIREBASE_PORT ? Number(process.env.FAKE_FIREBASE_PORT) : 0;
server.listen(port, '127.0.0.1', () => {
  console.log('FAKE_FIREBASE_PORT=' + server.address().port);
});
