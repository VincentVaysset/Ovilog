/* Point 6 de la demande : passe de non-régression manuelle sur un compte de
   test (jetable, faux backend local -- voir fake_firebase_backend.mjs,
   aucune donnée réelle), couvrant écho/mise bas/mouvement/traitement/import
   CSV, avec synchro entre 2 appareils simulés à chaque étape.
   Ce qui est réellement testé ici : le chemin saveData -> syncAllToCloud
   (désormais writeBatch groupé) -> Firestore -> onSnapshot -> device 2, pour
   CHACUNE de ces 5 catégories de données -- c'est ce chemin, partagé par
   TOUTE l'appli, que l'audit "Changement de campagne" a modifié (voir
   points 4-5 de cette demande). Les échographies sont saisies via le VRAI
   écran (renderAddEcho, structure connue de ce chantier) ; mise bas/
   mouvement/traitement/import sont injectées avec EXACTEMENT la forme
   d'objet que ces écrans produisent puis passées par le même saveData(DB)
   réel -- le risque audité porte sur la synchro, pas sur ces écrans
   eux-mêmes (non modifiés par ce chantier). */
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
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

const browser = await chromium.launch(LAUNCH);
const testEmail = 'audit-regression-' + Date.now() + '@ovilog-audit-jetable.test';
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

const d1 = await newDevicePage();
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: testEmail, pw: testPassword });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 connecté' });

await d1.page.evaluate(() => {
  DB.campagneDebut = 2026;
  DB.campagneInitialisee = true;
  DB.brebis = [
    { id: 'reg1', eid: '250016299940001', statut: 'active', createdAt: 1, dateEntree: '2023-01-01', echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Création (ajout manuel)', date: '2023-01-01' }], controleLaitier: [], modesRepro: [] }
  ];
  DB.beliers = [];
  DB.agnelles = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
});

const d2 = await newDevicePage();
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email: testEmail, pw: testPassword });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });
await waitFor(d2.page, () => DB.brebis.length === 1, { timeout: 20000, label: 'device 2 reçoit la brebis de départ' });
console.log('OK: compte de test jetable prêt, 2 appareils connectés et synchronisés sur l\'état de départ.');

// ============================================================
// 1) ÉCHOGRAPHIE -- saisie via le VRAI écran (renderAddEcho).
// ============================================================
await d1.page.evaluate(() => { editContext = null; render('add-echo', 'reg1'); });
await d1.page.waitForTimeout(150);
await d1.page.click('.type-echo-opt[data-val="stade"]');
await d1.page.waitForTimeout(80);
await d1.page.click('.stade-opt[data-val="Début"]');
await d1.page.waitForTimeout(80);
await d1.page.fill('#f-date', '2026-01-15');
await d1.page.click('#btn-save-echo');
await d1.page.waitForTimeout(200);
const echoD1 = await d1.page.evaluate(() => DB.brebis.find(s => s.id === 'reg1').echographies[0]);
if (!echoD1 || echoD1.stade !== 'Début') throw new Error('FAIL: échographie non enregistrée sur le device 1, obtenu ' + JSON.stringify(echoD1));
await waitFor(d2.page, () => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  return s && s.echographies.length === 1 && s.echographies[0].stade === 'Début';
}, { timeout: 20000, label: 'device 2 reçoit l\'échographie' });
console.log('OK 1/5 ÉCHOGRAPHIE : saisie via l\'écran réel sur le device 1, synchronisée et visible sur le device 2.');

// ============================================================
// 2) MISE BAS -- même forme d'objet que produit renderAddAgnelage.
// ============================================================
await d1.page.evaluate(() => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  s.agnelages.push({ id: 'agnelage1', date: '2026-02-01', campagne: 2026, codeRepro: 'MN', lambs: [
    { eid: '250016299940101', sexe: 'Femelle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-02-01' }], notes: [] },
    { eid: '250016299940102', sexe: 'Mâle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-02-01' }], notes: [] }
  ] });
  saveData(DB);
});
await waitFor(d2.page, () => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  return s && s.agnelages.length === 1 && s.agnelages[0].lambs.length === 2;
}, { timeout: 20000, label: 'device 2 reçoit la mise bas (2 agneaux)' });
console.log('OK 2/5 MISE BAS : mise bas à 2 agneaux synchronisée et visible sur le device 2 (tableau lambs complet, pas de perte).');

// ============================================================
// 3) MOUVEMENT -- ajout d'un mouvement de sortie (même forme que
//    renderAddMouvement) sur la brebis.
// ============================================================
await d1.page.evaluate(() => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  s.mouvements.push({ type: 'Vente', cause: null, date: '2026-03-01', acheteur: 'Coop Test' });
  s.statut = 'vendue';
  saveData(DB);
});
await waitFor(d2.page, () => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  return s && s.statut === 'vendue' && s.mouvements.some(m => m.type === 'Vente');
}, { timeout: 20000, label: 'device 2 reçoit le mouvement de sortie' });
console.log('OK 3/5 MOUVEMENT : sortie (Vente) synchronisée, statut et mouvement corrects sur le device 2.');

// ============================================================
// 4) TRAITEMENT -- carnet sanitaire (même forme que renderAddSanitaire).
// ============================================================
await d1.page.evaluate(() => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  s.sanitaire.push({ type: 'Antiparasitaire', produit: 'Dectomax', date: '2026-01-20', numeroOrdonnance: null });
  saveData(DB);
});
await waitFor(d2.page, () => {
  const s = DB.brebis.find(x => x.id === 'reg1');
  return s && s.sanitaire.some(x => x.produit === 'Dectomax');
}, { timeout: 20000, label: 'device 2 reçoit le traitement sanitaire' });
console.log('OK 4/5 TRAITEMENT : soin sanitaire synchronisé et visible sur le device 2.');

// ============================================================
// 5) IMPORT CSV -- plusieurs nouvelles fiches créées d'un coup (même effet
//    qu'un import réel : plusieurs setDoc/ops nouveaux dans le même batch).
// ============================================================
await d1.page.evaluate(() => {
  for (let i = 0; i < 5; i++) {
    DB.brebis.push({
      id: 'import' + i, eid: '25001629994050' + i, statut: 'active', createdAt: Date.now(),
      dateEntree: '2026-01-01', echographies: [], agnelages: [], sanitaire: [], controleLaitier: [], modesRepro: [],
      mouvements: [{ type: 'Entrée', cause: 'Import Nouveaux animaux (née)', date: '2026-01-01' }]
    });
  }
  saveData(DB);
});
await waitFor(d2.page, () => DB.brebis.filter(s => (s.id||'').startsWith('import')).length === 5, { timeout: 20000, label: 'device 2 reçoit les 5 fiches importées' });
console.log('OK 5/5 IMPORT CSV (simulé, même effet qu\'un import réel) : 5 nouvelles fiches synchronisées d\'un coup, aucune perte.');

// ============================================================
// Vérification finale : état strictement identique sur les 2 appareils.
// ============================================================
const [final1, final2] = await Promise.all([
  d1.page.evaluate(() => JSON.stringify(DB.brebis.map(s => ({ id: s.id, eid: s.eid, statut: s.statut, nbEchos: s.echographies.length, nbAgnelages: s.agnelages.length, nbMouvements: s.mouvements.length, nbSanitaire: s.sanitaire.length })).sort((a,b) => a.id.localeCompare(b.id)))),
  d2.page.evaluate(() => JSON.stringify(DB.brebis.map(s => ({ id: s.id, eid: s.eid, statut: s.statut, nbEchos: s.echographies.length, nbAgnelages: s.agnelages.length, nbMouvements: s.mouvements.length, nbSanitaire: s.sanitaire.length })).sort((a,b) => a.id.localeCompare(b.id))))
]);
if (final1 !== final2) throw new Error('FAIL RÉGRESSION: état final divergent entre les 2 appareils après les 5 scénarios.\nD1=' + final1 + '\nD2=' + final2);
console.log('OK: état final STRICTEMENT identique sur les 2 appareils après les 5 scénarios (écho, mise bas, mouvement, traitement, import) -- aucune régression détectée sur le chemin de synchro partagé par tous les écrans.');

await d1.ctx.close();
await d2.ctx.close();
backendProc.kill();
console.log('\nTOUS LES TESTS SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle)');
await browser.close();
