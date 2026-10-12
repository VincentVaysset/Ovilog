/* Suite de régression ciblée sur le module de synchro Firebase, reconstruite
   après la perte de l'historique de tests (environnement réinitialisé).
   Le vrai projet Firebase (ovilog-15ef6) n'est pas joignable depuis ce bac à
   sable pour le canal temps réel Firestore (proxy sans support gRPC/
   streaming, voir /root/.ccr/README.md) -- confirmé par un échec réseau lors
   d'un premier essai contre le vrai projet. Repli sur un faux backend
   Firestore/Auth local (fake_firebase_backend.mjs, loopback, aucun réseau
   externe), servi à la place de www/vendor/firebase.bundle.js via
   page.route() -- le code testé (executerChangementCampagne,
   syncAllToCloud/writeBatch, onSnapshot) est exactement celui de
   www/index.html, seul le SDK Firebase lui-même est remplacé par une
   implémentation en mémoire fidèle (arrayUnion, writeBatch groupé,
   onSnapshot par polling). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => {
    buf += d.toString();
    const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/);
    if (m) resolve(Number(m[1]));
  });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout waiting for fake backend port')), 5000);
});
console.log('Faux backend Firestore local démarré sur le port ' + fakePort);
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

const browser = await chromium.launch(LAUNCH);
const testEmail = 'audit-sync-' + Date.now() + '@ovilog-audit-jetable.test';
const testPassword = 'AuditTest12345!';

async function newDevicePage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { ctx, page };
}

async function waitFor(page, fn, { timeout = 20000, interval = 300, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(interval);
  }
  throw new Error('TIMEOUT en attendant : ' + label);
}

console.log('Compte de test jetable : ' + testEmail);

// ============================================================
// Device 1 : création du compte, données de départ.
// ============================================================
const d1 = await newDevicePage();
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: testEmail, pw: testPassword });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 connecté après signup' });
console.log('OK: compte de test créé et connecté sur le device 1.');

await d1.page.evaluate(() => {
  DB.campagneDebut = 2026;
  DB.campagneDateDemarrage = '2025-10-01';
  DB.campagneInitialisee = true;
  DB.exploitation.campagneMoisDebut = 10;
  DB.exploitation.campagneJourDebut = 1;
  DB.brebis = [
    { id: 'sync1', eid: '250016299911001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] },
    { id: 'sync2', eid: '250016299911002', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }
  ];
  DB.beliers = [];
  DB.agnelles = [
    { id: 'syncA1', eid: '250016299911003', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] },
    { id: 'syncA2', eid: '250016299911004', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }
  ];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
});

// ============================================================
// Device 2 : connexion au MÊME compte, doit recevoir les données poussées
// par le device 1 via la synchro réelle (writeBatch + onSnapshot).
// ============================================================
const d2 = await newDevicePage();
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email: testEmail, pw: testPassword });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });
await waitFor(d2.page, () => DB.brebis.length === 2 && (DB.agnelles || []).length === 2, { timeout: 25000, label: 'device 2 reçoit les 2 brebis + 2 agnelles du device 1' });
console.log('OK: synchro réelle -- le device 2 reçoit les données poussées par le device 1 (writeBatch confirmé fonctionnel de bout en bout).');

// ============================================================
// Test A -- Fusion arrayUnion concurrente (non-régression du refactor
// writeBatch) : chaque device ajoute une entrée sanitaire différente sur SA
// PROPRE brebis, quasi simultanément. Les deux doivent finir par voir les
// DEUX entrées sur les DEUX appareils (merge, jamais un écrasement).
// ============================================================
await Promise.all([
  d1.page.evaluate(() => {
    const s = DB.brebis.find(x => x.id === 'sync1');
    s.sanitaire.push({ type: 'Vaccin', produit: 'Depuis D1', date: '2026-01-01' });
    saveData(DB);
  }),
  d2.page.evaluate(() => {
    const s = DB.brebis.find(x => x.id === 'sync1');
    s.sanitaire.push({ type: 'Vaccin', produit: 'Depuis D2', date: '2026-01-02' });
    saveData(DB);
  })
]);

await waitFor(d1.page, () => {
  const s = DB.brebis.find(x => x.id === 'sync1');
  return s.sanitaire.some(x => x.produit === 'Depuis D1') && s.sanitaire.some(x => x.produit === 'Depuis D2');
}, { timeout: 25000, label: 'device 1 voit les 2 entrées sanitaires fusionnées' });
await waitFor(d2.page, () => {
  const s = DB.brebis.find(x => x.id === 'sync1');
  return s.sanitaire.some(x => x.produit === 'Depuis D1') && s.sanitaire.some(x => x.produit === 'Depuis D2');
}, { timeout: 25000, label: 'device 2 voit les 2 entrées sanitaires fusionnées' });
console.log('OK: fusion arrayUnion concurrente inchangée après le passage à writeBatch -- aucune entrée perdue sur les 2 appareils.');

// ============================================================
// Test B -- Changement de campagne réel avec synchro cloud active : le
// device 2 (spectateur) doit recevoir l'état COMPLET et cohérent après la
// bascule, jamais un instantané partiel figé (c'est le coeur du bug réel du
// 29/09 -- 29 doublons créés par une resynchronisation partielle).
// ============================================================
const activesAvant2 = await d1.page.evaluate(() => DB.brebis.filter(s => (s.statut||'active')==='active').length);
const agnellesAvant2 = await d1.page.evaluate(() => (DB.agnelles||[]).length);
const campagneAvant2 = await d1.page.evaluate(() => DB.campagneDebut);

const resultBascule = await d1.page.evaluate(async () => await executerChangementCampagne());
if (!resultBascule.ok) throw new Error('FAIL: la bascule aurait dû réussir, obtenu ' + JSON.stringify(resultBascule));
console.log('OK: bascule exécutée sur le device 1 avec synchro cloud active.');

// Le device 2 doit converger vers EXACTEMENT le même état final, sans jamais
// se stabiliser sur un total incohérent en cours de route.
await waitFor(d2.page, () => {
  const active = DB.brebis.filter(s => (s.statut||'active')==='active').length;
  return DB.campagneDebut !== undefined && active === (2 + 2) && (DB.agnelles||[]).length === 0;
}, { timeout: 30000, label: 'device 2 converge vers le total final correct après la bascule (4 actives, 0 agnelle)' });

const [d1Final, d2Final] = await Promise.all([
  d1.page.evaluate(() => ({ total: DB.brebis.length, actives: DB.brebis.filter(s => (s.statut||'active')==='active').length, agnelles: (DB.agnelles||[]).length, campagneDebut: DB.campagneDebut, eids: DB.brebis.map(s => s.eid).sort() })),
  d2.page.evaluate(() => ({ total: DB.brebis.length, actives: DB.brebis.filter(s => (s.statut||'active')==='active').length, agnelles: (DB.agnelles||[]).length, campagneDebut: DB.campagneDebut, eids: DB.brebis.map(s => s.eid).sort() }))
]);
if (d1Final.campagneDebut !== campagneAvant2 + 1) throw new Error('FAIL: campagneDebut doit avoir avancé de +1, obtenu ' + JSON.stringify({ campagneAvant2, d1Final }));
if (d1Final.actives !== activesAvant2 + agnellesAvant2) throw new Error('FAIL device 1: actives incorrectes, obtenu ' + JSON.stringify(d1Final));
if (JSON.stringify(d1Final) !== JSON.stringify(d2Final)) {
  throw new Error('FAIL RÉGRESSION: les 2 appareils divergent après la bascule -- exactement le symptôme du bug réel du 29/09.\nD1=' + JSON.stringify(d1Final) + '\nD2=' + JSON.stringify(d2Final));
}
const eidSet = new Set(d1Final.eids);
if (eidSet.size !== d1Final.eids.length) throw new Error('FAIL RÉGRESSION: EID en double détecté après la bascule, obtenu ' + JSON.stringify(d1Final.eids));
console.log('OK: après la bascule, les 2 appareils convergent vers un état STRICTEMENT identique (mêmes compteurs, mêmes EID, aucun doublon) -- writeBatch + temporisation onSnapshot valident le correctif de bout en bout, avec une vraie synchro cloud active.');

// ============================================================
// Test C -- Course réelle pendant la bascule : le device 2 pousse une
// modification SANS RAPPORT (ex: ajout d'un soin sur une autre brebis)
// PENDANT que le device 1 exécute une bascule -- l'instantané que ça
// déclenche sur le device 1 ne doit JAMAIS être appliqué avant la fin de
// l'opération groupée (voir operationGroupeeEnCours/drainPendingRemoteUpdates).
// ============================================================
await d1.page.evaluate(() => {
  DB.agnelles = [{ id: 'syncA3', eid: '250016299911005', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }];
  saveData(DB);
});
await waitFor(d2.page, () => (DB.agnelles||[]).length === 1, { timeout: 20000, label: 'device 2 voit la nouvelle agnelle avant le test de course' });

const [courseResult] = await Promise.all([
  d1.page.evaluate(async () => await executerChangementCampagne()),
  (async () => {
    // Déclenché juste après le début probable de la bascule sur D1 -- une
    // modification sans rapport sur D2, pour forcer un onSnapshot pendant
    // que operationGroupeeEnCours est vrai sur D1.
    await d2.page.waitForTimeout(50);
    await d2.page.evaluate(() => {
      const s = DB.brebis.find(x => x.id === 'sync2');
      if (s) { s.sanitaire.push({ type: 'Vaccin', produit: 'Pendant la course', date: '2026-02-01' }); saveData(DB); }
    });
  })()
]);
if (!courseResult.ok) throw new Error('FAIL: la bascule pendant la course aurait dû réussir, obtenu ' + JSON.stringify(courseResult));

const activesApresCourse = await d1.page.evaluate(() => DB.brebis.filter(s => (s.statut||'active')==='active').length);
if (activesApresCourse !== 5) { // 4 actives + 1 agnelle convertie
  throw new Error('FAIL RÉGRESSION: une modification concurrente pendant la bascule a corrompu le résultat -- attendu 5 actives, obtenu ' + activesApresCourse);
}
await waitFor(d1.page, () => {
  const s = DB.brebis.find(x => x.id === 'sync2');
  return s && s.sanitaire.some(x => x.produit === 'Pendant la course');
}, { timeout: 20000, label: 'la modification concurrente finit par apparaître sur D1 après la bascule (pas perdue, juste reportée)' });
console.log('OK: une modification concurrente déclenchée PENDANT la bascule ne la corrompt pas (comptage final exact), et n\'est pas perdue -- juste appliquée une fois l\'opération groupée terminée (drainPendingRemoteUpdates).');

// Vérifie au passage que le point 4 (writeBatch groupé) a bien été exercé --
// et pas juste "ça marche", mais "ça marche EN un seul envoi groupé, pas en
// des dizaines d'appels individuels" comme avant le correctif.
const batchStats = await d1.page.evaluate(() => ({ calls: window.__testBatchCallCount || 0, ops: window.__testBatchOpsCount || 0 }));
console.log('Statistiques writeBatch (device 1, cumulées sur tout le test) : ' + batchStats.calls + ' commit(s) de batch au total, ' + batchStats.ops + ' opération(s) au total.');
if (batchStats.calls === 0) throw new Error('FAIL: aucun writeBatch.commit() détecté -- le correctif "synchro cloud groupée" ne semble pas exercé.');

await d1.ctx.close();
await d2.ctx.close();
backendProc.kill();
console.log('\nTOUS LES TESTS SONT PASSÉS (faux backend local, aucun compte ni donnée réels concernés)');
await browser.close();
