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

const users = new Map(); // email -> { uid, password }
const collections = new Map(); // uid -> { colName -> { docId -> data } }
const metas = new Map(); // uid -> data
const versions = new Map(); // uid -> { colName|'meta' -> integer, bumped on every write }

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
      users.set(email, { uid, password });
      ensureUser(uid);
      return json(res, 200, { uid });
    }
    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const { email, password } = await readBody(req);
      const u = users.get(email);
      if (!u || u.password !== password) return json(res, 400, { error: 'invalid-credential' });
      ensureUser(u.uid);
      return json(res, 200, { uid: u.uid });
    }
    if (url.pathname === '/batch' && req.method === 'POST') {
      const { uid, ops } = await readBody(req);
      ensureUser(uid);
      const cols = collections.get(uid);
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
      return json(res, 200, { ok: true });
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
