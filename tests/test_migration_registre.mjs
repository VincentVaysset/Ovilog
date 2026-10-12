/* Teste la migration du registre (chantier "Registre : collection dédiée",
   1re étape -- migration seule) sur les VRAIES données de registre de
   l'export du 29/09 (342 brebis + 0 bélier + 115 agnelles = 457 entrées) :
   1. DB.registre avant/après strictement identique (contenu, pas juste le
      compte).
   2. 457 documents créés côté cloud (collection dédiée).
   3. Relance de la migration idempotente (aucun doublon, aucune erreur).
   4. Un 2e appareil simulé reçoit tout sans doublon ni perte.
   5. Protection "création seulement" : un document déjà présent côté cloud
      (simulant un autre appareil ayant migré en premier, avec un contenu
      volontairement différent pour le détecter) n'est jamais écrasé.
   Faux backend Firestore local -- aucune donnée réelle, aucune bascule. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
let cleanedUp = false;
function cleanup() { if (cleanedUp) return; cleanedUp = true; try { backendProc.kill(); } catch (e) {} }
process.on('exit', cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); cleanup(); process.exit(1); });

const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => {
    buf += d.toString();
    const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/);
    if (m) resolve(Number(m[1]));
  });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

// Vraies données de registre du 29/09 -- seule la clé 'registre' est utilisée ici.
const exportComplet = lireExport(EXPORT_ORIGINAL);
const registreReel = exportComplet.registre;
const totalAttendu = Object.keys(registreReel.brebis).length + Object.keys(registreReel.beliers).length + Object.keys(registreReel.agnelles).length;
console.log('Registre réel chargé : ' + Object.keys(registreReel.brebis).length + ' brebis + ' + Object.keys(registreReel.beliers).length + ' bélier(s) + ' + Object.keys(registreReel.agnelles).length + ' agnelles = ' + totalAttendu + ' entrées attendues.');

const browser = await chromium.launch(LAUNCH);

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
async function waitFor(page, fn, { timeout = 20000, interval = 200, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(interval);
  }
  throw new Error('TIMEOUT en attendant : ' + label);
}

const email = 'migration-registre-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';

// ============================================================
// Device 1 : compte tout neuf (cloud vide), bootstrap normal, PUIS on
// simule "cet appareil avait déjà, avant cette mise à jour, un registre
// riche jamais migré" en l'injectant directement et en forçant une
// reconnexion (qui redéclenche migrerRegistreVersCollection).
// ============================================================
const d1 = await newDevicePage();
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 connecté' });
await d1.page.waitForTimeout(400); // laisse le bootstrap initial (cloud vide) se terminer

const avantSnapshot = await d1.page.evaluate((registre) => {
  DB.registre = JSON.parse(JSON.stringify(registre));
  DB.registreCollectionMigree20260930 = false;
  localStorage.setItem('troupeau_data_v1', JSON.stringify(DB)); // contourne saveData -- pas de push avant la migration testée
  return JSON.parse(JSON.stringify(DB.registre));
}, registreReel);

// Récupère l'uid pour interroger directement le faux backend.
const uidToUse = await d1.page.evaluate(async () => {
  return await new Promise(resolve => {
    const origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.includes('/batch') && opts && opts.body) {
        try { resolve(JSON.parse(opts.body).uid); } catch (e) {}
      }
      return origFetch.apply(this, arguments);
    };
    DB.brebis = DB.brebis || [];
    saveData(DB); // déclenche un writeBatch minimal pour capter l'uid (même si vide, buildMetaOp poussera toujours qqch au 1er appel)
    setTimeout(() => resolve(null), 800);
  });
});
if (!uidToUse) throw new Error('FAIL (infra test) : impossible de déterminer l\'uid du compte de test.');
await d1.page.waitForTimeout(300);

// Force une reconnexion (comme une réouverture d'appli) : déclenche
// onSignedIn -> migrerRegistreVersCollection avec le registre injecté juste
// au-dessus toujours en mémoire (jamais poussé avant, voir localStorage.setItem
// ci-dessus qui contourne saveData).
await d1.page.evaluate(async ({ email, pw }) => {
  window.OvilogSync.logout();
  await new Promise(r => setTimeout(r, 200));
  await window.OvilogSync.login(email, pw);
}, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 reconnecté' });
await waitFor(d1.page, () => DB.registreCollectionMigree20260930 === true, { timeout: 20000, label: 'le drapeau de migration passe à true' });
console.log('OK (infra) : migration déclenchée par la reconnexion, drapeau posé.');

// ---- Vérif 1 : DB.registre avant/après strictement identique ----
const apresSnapshot = await d1.page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
if (JSON.stringify(avantSnapshot) !== JSON.stringify(apresSnapshot)) {
  throw new Error('FAIL point 1: DB.registre doit être strictement identique avant/après la migration.\nAVANT (extrait)=' + JSON.stringify(avantSnapshot).slice(0,300) + '\nAPRES (extrait)=' + JSON.stringify(apresSnapshot).slice(0,300));
}
console.log('OK point 1: DB.registre est strictement identique avant/après la migration (forme imbriquée inchangée pour tout le code existant).');

// ---- Vérif 2 : 457 documents créés côté cloud ----
const snapCloud = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uidToUse + '&col=registre').then(r => r.json());
const nbDocsCloud = Object.keys(snapCloud.docs).length;
if (nbDocsCloud !== totalAttendu) {
  throw new Error('FAIL point 2: attendu ' + totalAttendu + ' documents dans la collection registre, obtenu ' + nbDocsCloud);
}
console.log('OK point 2: exactement ' + nbDocsCloud + ' documents créés dans la collection dédiée users/{uid}/registre/{id} (342 brebis + 0 bélier + 115 agnelles).');

// Vérifie le contenu d'un document précis (une vraie brebis archivée de l'export).
const uneBrebisEid = Object.keys(registreReel.brebis)[0];
const idAttendu = 'brebis_' + uneBrebisEid.replace(/\s+/g, '');
const docBrebis = snapCloud.docs[idAttendu];
if (!docBrebis || docBrebis.eid !== uneBrebisEid || JSON.stringify(docBrebis.mouvements) !== JSON.stringify(registreReel.brebis[uneBrebisEid].mouvements || [])) {
  throw new Error('FAIL point 2: le document ' + idAttendu + ' doit porter le contenu exact de la fiche registre d\'origine, obtenu ' + JSON.stringify(docBrebis));
}
console.log('OK point 2 (détail): le contenu d\'un document migré (mouvements, EID) correspond exactement à la fiche d\'origine du registre.');

// ---- Vérif 3 : relance idempotente ----
await d1.page.evaluate(() => { DB.registreCollectionMigree20260930 = false; }); // force une 2e tentative
const compteBatchAvant2e = await d1.page.evaluate(() => window.__testBatchCallCount || 0);
await d1.page.evaluate(async ({ email, pw }) => {
  window.OvilogSync.logout();
  await new Promise(r => setTimeout(r, 200));
  await window.OvilogSync.login(email, pw);
}, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 reconnecté (2e fois)' });
await waitFor(d1.page, () => DB.registreCollectionMigree20260930 === true, { timeout: 20000, label: 'le drapeau repasse à true après la 2e tentative' });
const snapCloudApres2e = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uidToUse + '&col=registre').then(r => r.json());
if (Object.keys(snapCloudApres2e.docs).length !== totalAttendu) {
  throw new Error('FAIL point 3: une 2e migration ne doit créer AUCUN doublon, obtenu ' + Object.keys(snapCloudApres2e.docs).length + ' documents (attendu ' + totalAttendu + ').');
}
if (JSON.stringify(snapCloudApres2e.docs) !== JSON.stringify(snapCloud.docs)) {
  throw new Error('FAIL point 3: le contenu de la collection ne doit pas changer lors d\'une 2e migration (idempotence).');
}
console.log('OK point 3: relancer la migration est idempotent -- toujours ' + totalAttendu + ' documents, contenu strictement inchangé, aucun doublon.');

await d1.ctx.close();

// ============================================================
// Vérif 4 : un 2e appareil simulé reçoit tout sans doublon ni perte.
// ============================================================
const d2 = await newDevicePage();
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });
await waitFor(d2.page, () => {
  const r = DB.registre;
  return r && Object.keys(r.brebis || {}).length + Object.keys(r.beliers || {}).length + Object.keys(r.agnelles || {}).length === 457;
}, { timeout: 20000, label: 'device 2 reçoit les 457 entrées du registre' });
const registreDevice2 = await d2.page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
if (JSON.stringify(registreDevice2) !== JSON.stringify(avantSnapshot)) {
  throw new Error('FAIL point 4: le registre reçu par le device 2 doit être identique à l\'original, sans perte ni doublon.');
}
console.log('OK point 4: un 2e appareil connecté après coup reçoit exactement les 457 entrées, contenu identique à l\'original, sans doublon.');
// device 2 ne doit PAS re-déclencher sa propre migration à vide (son registre
// local, avant réception, était vide -- rien à migrer depuis lui-même) :
// vérifie que le drapeau est déjà vrai chez lui sans avoir eu à créer quoi
// que ce soit lui-même (déjà vérifié par le compte de documents stable).
if (!(await d2.page.evaluate(() => DB.registreCollectionMigree20260930))) {
  throw new Error('FAIL point 4: le drapeau de migration doit être reçu (vrai) sur le device 2 aussi, via la synchro normale du champ meta.');
}
console.log('OK point 4: le drapeau de migration (cloud, champ meta) est bien reçu par le device 2 sans qu\'il ait besoin de migrer lui-même.');

// ============================================================
// Vérif 5 : protection "création seulement" -- un document déjà présent
// (contenu volontairement différent, simulant un autre appareil ayant migré
// en premier) n'est JAMAIS écrasé par une migration relancée ailleurs.
// ============================================================
const idCible = 'agnelle_' + Object.keys(registreReel.agnelles)[0].replace(/\s+/g, '');
const contenuSentinelle = { eid: Object.keys(registreReel.agnelles)[0], categorie: 'agnelles', sanitaire: [], agnelages: [], mouvements: [{ type: 'SENTINELLE_TEST', date: '2099-01-01' }] };
await fetch('http://127.0.0.1:' + fakePort + '/batch', {
  method: 'POST',
  body: JSON.stringify({ uid: uidToUse, ops: [{ type: 'set', path: 'users/' + uidToUse + '/registre/' + idCible, data: contenuSentinelle }] })
});
await d2.page.evaluate(() => { DB.registreCollectionMigree20260930 = false; });
await d2.page.evaluate(async ({ email, pw }) => {
  window.OvilogSync.logout();
  await new Promise(r => setTimeout(r, 200));
  await window.OvilogSync.login(email, pw);
}, { email, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 reconnecté (test sentinelle)' });
await waitFor(d2.page, () => DB.registreCollectionMigree20260930 === true, { timeout: 20000, label: 'la migration se termine malgré le document sentinelle déjà présent' });
const snapApresSentinelle = await fetch('http://127.0.0.1:' + fakePort + '/getdoc?uid=' + uidToUse + '&col=registre&id=' + idCible).then(r => r.json());
if (JSON.stringify(snapApresSentinelle.data.mouvements) !== JSON.stringify(contenuSentinelle.mouvements)) {
  throw new Error('FAIL point 5: un document déjà présent côté cloud ne doit JAMAIS être écrasé par une migration relancée, obtenu ' + JSON.stringify(snapApresSentinelle.data));
}
console.log('OK point 5: un document déjà présent côté cloud (simulant un autre appareil ayant migré en premier) n\'est jamais écrasé -- protection "création seulement" confirmée.');

await d2.ctx.close();
cleanup();
console.log('\nTOUS LES TESTS DE MIGRATION SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle, aucune bascule réelle)');
await browser.close();
