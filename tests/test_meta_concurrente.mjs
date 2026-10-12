/* Teste explicitement demandé avant le build : 2 appareils modifient des
   champs meta DIFFÉRENTS (laitTank, produits, causesMortalite, journal) au
   même moment -- aucun ne doit écraser l'autre. Ce scénario exerce
   directement la fusion champ par champ de meta (fusionnerEnregistrementDistant,
   voir le correctif de l'étape 2 du chantier "Compléter le changement de
   campagne" -- avant ce correctif, meta était réécrit en bloc, sans fusion).
   Faux backend Firestore local -- aucune donnée réelle. */
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

const email = 'meta-concurrente-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';

const d1 = await newDevicePage();
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 1 connecté' });
await d1.page.evaluate(() => {
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.brebis = []; DB.beliers = []; DB.agnelles = [];
  DB.laitTank = []; DB.produits = ['Dectomax']; DB.causesMortalite = ['Maladie']; DB.journal = [];
  saveData(DB);
});
await d1.page.waitForTimeout(500);

const d2 = await newDevicePage();
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });
await waitFor(d2.page, () => DB.produits && DB.produits.length === 1, { label: 'device 2 reçoit l\'état initial' });
console.log('OK (infra) : 2 appareils connectés, synchronisés sur l\'état meta initial (laitTank=[], produits=1, causesMortalite=1, journal=[]).');

// ============================================================
// Les 2 appareils modifient, EN MÊME TEMPS, 4 champs meta DIFFÉRENTS :
// device 1 -> laitTank + causesMortalite ; device 2 -> produits + journal.
// Aucune coordination entre les 2 appels (Promise.all).
// ============================================================
await Promise.all([
  d1.page.evaluate(() => {
    DB.laitTank.push({ date: '2026-01-15', quantite: 320.5 });
    DB.causesMortalite.push('Piétin');
    saveData(DB);
  }),
  d2.page.evaluate(() => {
    DB.produits.push('Cydectine');
    DB.journal.push({ type: 'Tonte', date: '2026-01-15', note: 'Tonte du troupeau' });
    saveData(DB);
  })
]);

// Convergence attendue sur LES DEUX appareils : les 4 champs modifiés,
// aucun écrasé par l'autre.
async function etatComplet(page) {
  return await page.evaluate(() => ({
    laitTank: DB.laitTank,
    produits: DB.produits,
    causesMortalite: DB.causesMortalite,
    journal: DB.journal
  }));
}
await waitFor(d1.page, () => DB.laitTank.length === 1 && DB.produits.length === 2 && DB.causesMortalite.length === 2 && DB.journal.length === 1,
  { timeout: 20000, label: 'device 1 converge vers les 4 champs modifiés' });
await waitFor(d2.page, () => DB.laitTank.length === 1 && DB.produits.length === 2 && DB.causesMortalite.length === 2 && DB.journal.length === 1,
  { timeout: 20000, label: 'device 2 converge vers les 4 champs modifiés' });

const [etat1, etat2] = await Promise.all([etatComplet(d1.page), etatComplet(d2.page)]);
if (JSON.stringify(etat1) !== JSON.stringify(etat2)) {
  throw new Error('FAIL: état meta divergent entre les 2 appareils après convergence attendue.\nD1=' + JSON.stringify(etat1) + '\nD2=' + JSON.stringify(etat2));
}
if (etat1.laitTank.length !== 1 || etat1.laitTank[0].quantite !== 320.5) throw new Error('FAIL: laitTank (device 1) non préservé, obtenu ' + JSON.stringify(etat1.laitTank));
if (etat1.causesMortalite.length !== 2 || !etat1.causesMortalite.includes('Piétin')) throw new Error('FAIL: causesMortalite (device 1) non préservé, obtenu ' + JSON.stringify(etat1.causesMortalite));
if (etat1.produits.length !== 2 || !etat1.produits.includes('Cydectine')) throw new Error('FAIL: produits (device 2) non préservé, obtenu ' + JSON.stringify(etat1.produits));
if (etat1.journal.length !== 1 || etat1.journal[0].type !== 'Tonte') throw new Error('FAIL: journal (device 2) non préservé, obtenu ' + JSON.stringify(etat1.journal));
console.log('OK: les 4 champs meta modifiés simultanément par 2 appareils DIFFÉRENTS (laitTank+causesMortalite sur device 1, produits+journal sur device 2) coexistent tous, sans qu\'aucun n\'écrase l\'autre.');

// ============================================================
// Cas plus dur : les 2 appareils modifient LE MÊME champ (causesMortalite)
// simultanément, avec des ajouts DIFFÉRENTS -- vérifie que ça ne perd pas
// une des deux entrées (arrayUnion / fusion), sans exiger un ordre précis.
// ============================================================
await Promise.all([
  d1.page.evaluate(() => { DB.causesMortalite.push('Predation'); saveData(DB); }),
  d2.page.evaluate(() => { DB.causesMortalite.push('Meteo'); saveData(DB); })
]);
await waitFor(d1.page, () => DB.causesMortalite.includes('Predation') && DB.causesMortalite.includes('Meteo'), { timeout: 20000, label: 'device 1 voit les 2 ajouts concurrents à causesMortalite' });
await waitFor(d2.page, () => DB.causesMortalite.includes('Predation') && DB.causesMortalite.includes('Meteo'), { timeout: 20000, label: 'device 2 voit les 2 ajouts concurrents à causesMortalite' });
console.log('OK: 2 ajouts concurrents au MÊME champ meta (causesMortalite) par 2 appareils différents coexistent tous les deux -- aucune perte.');

await d1.ctx.close();
await d2.ctx.close();
cleanup();
console.log('\nTOUS LES TESTS DE META CONCURRENTE SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle)');
await browser.close();
