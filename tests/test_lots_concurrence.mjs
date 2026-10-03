/* Chantier de tri, partie a : CONCURRENCE PC / mobile sur un même lot de reproduction, avec le VRAI code de synchro (faux backend Firestore
   local, compte jetable, aucune donnée réelle). Deux appareils retirent/ajoutent des brebis EN MÊME TEMPS : aucune perte silencieuse (un
   événement = un document, rejeu déterministe) ; un appareil « non à jour » qui modifie lot.membres hors journal est détecté, jamais écrasé ;
   la suppression d'un lot emporte son journal. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
let cleanedUp = false;
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
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

async function newDevicePage(desktop) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(d => { window.electronAPI = d ? { isDesktop: true, version: '1.0.test' } : undefined; }, desktop);
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


const email = 'lots-concurrence-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';
const eid = n => '25001629919' + String(n).padStart(5, '0');
const membresTries = page => page.evaluate(() => DB.lots.find(l => l.id === 'LC').membres.map(cleanEid).sort().join(','));
const nEvenements = page => page.evaluate(() => DB.evenementsLots.filter(e => e.lotId === 'LC').length);
const attendu = ns => ns.map(n => eid(n)).sort().join(',');

const d1 = await newDevicePage(true);          // PC
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
await d1.page.evaluate(() => {
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.brebis = []; DB.beliers = []; DB.agnelles = [];
  creerLotReproductionJournalise({ id: 'LC', nom: 'IA du 15-06-2027', mode: 'IA', cible: 'Brebis', dateCreation: '2027-06-15', dateEvenement: '2027-06-15', campagneMisesBas: 2027 }, [1, 2, 3, 4, 5].map(n => '25001629919' + String(n).padStart(5, '0')));
  saveData(DB);
});
await d1.page.waitForTimeout(500);

const d2 = await newDevicePage(false);         // mobile
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'mobile connecté' });
await waitFor(d2.page, () => DB.lots.some(l => l.id === 'LC') && DB.evenementsLots.length === 1, { label: 'le mobile reçoit le lot et son événement initial' });
check(await membresTries(d2.page) === attendu([1, 2, 3, 4, 5]), 'le mobile voit les 5 brebis du lot créé sur PC');
console.log('OK (infra) : PC et mobile connectés, lot « IA du 15-06-2027 » (5 brebis) synchronisé.');

// ---------- 1. retraits et ajouts CROISÉS en même temps ----------
await Promise.all([
  d1.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LC'); ajouterEvenementLot(l, 'retrait', [E1()]); ajouterEvenementLot(l, 'affectation', [E6()]); saveData(DB); function E1() { return '25001629919' + '00001'; } function E6() { return '25001629919' + '00006'; } }),
  d2.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LC'); ajouterEvenementLot(l, 'retrait', ['25001629919' + '00002'], { motif: 'Malade' }); ajouterEvenementLot(l, 'affectation', ['25001629919' + '00007']); saveData(DB); })
]);
await waitFor(d1.page, () => DB.evenementsLots.filter(e => e.lotId === 'LC').length === 5, { label: 'PC reçoit les 4 événements' });
await waitFor(d2.page, () => DB.evenementsLots.filter(e => e.lotId === 'LC').length === 5, { label: 'mobile reçoit les 4 événements' });
await waitFor(d1.page, () => DB.lots.find(l => l.id === 'LC').membres.length === 5, { label: 'PC converge' });
await waitFor(d2.page, () => DB.lots.find(l => l.id === 'LC').membres.length === 5, { label: 'mobile converge' });
const [m1, m2] = [await membresTries(d1.page), await membresTries(d2.page)];
check(m1 === m2 && m1 === attendu([3, 4, 5, 6, 7]), 'retraits/ajouts croisés simultanés : les 2 appareils convergent vers {3,4,5,6,7}, rien de perdu : PC=' + m1 + ' mobile=' + m2);
check(await d1.page.evaluate(() => ecartsMembresLots().length) === 0 && await d2.page.evaluate(() => ecartsMembresLots().length) === 0, 'aucun écart signalé sur aucun appareil');
console.log('OK 1 retraits (1 et 2) et ajouts (6 et 7) croisés en même temps sur PC et mobile : convergence identique, aucune perte silencieuse.');

// ---------- 2. conflit sur la MÊME brebis : même résultat des deux côtés ----------
await Promise.all([
  d1.page.evaluate(() => { ajouterEvenementLot(DB.lots.find(x => x.id === 'LC'), 'retrait', ['25001629919' + '00004']); saveData(DB); }),
  d2.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LC'); ajouterEvenementLot(l, 'retrait', ['25001629919' + '00004']); ajouterEvenementLot(l, 'affectation', ['25001629919' + '00004']); saveData(DB); })
]);
await waitFor(d1.page, () => DB.evenementsLots.filter(e => e.lotId === 'LC').length === 8, { label: 'PC reçoit les événements du conflit' });
await waitFor(d2.page, () => DB.evenementsLots.filter(e => e.lotId === 'LC').length === 8, { label: 'mobile reçoit les événements du conflit' });
await d1.page.waitForTimeout(600);
const [c1, c2] = [await membresTries(d1.page), await membresTries(d2.page)];
check(c1 === c2, 'conflit sur la même brebis (retrait / retrait puis ré-ajout) : résultat déterministe identique sur les 2 appareils : PC=' + c1 + ' mobile=' + c2);
console.log('OK 2 conflit sur une même brebis : les 2 appareils rejouent le même journal, même résultat.');

// ---------- 3. affectation groupée de 100 brebis = 1 document ----------
await d1.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LC'); ajouterEvenementLot(l, 'affectation', Array.from({ length: 100 }, (_, i) => '25001629919' + String(2000 + i).padStart(5, '0'))); saveData(DB); });
await waitFor(d2.page, () => DB.lots.find(l => l.id === 'LC').membres.length >= 100, { label: 'mobile reçoit les 100 brebis' });
check(await nEvenements(d2.page) === 9, '100 brebis affectées d\'un coup = 1 seul événement (document) de plus : ' + await nEvenements(d2.page));
console.log('OK 3 affectation groupée : 100 brebis, 1 document, reçue sur mobile.');

// ---------- 4. appareil « non à jour » : modification hors journal détectée, jamais écrasée ----------
await d2.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LC'); l.membres.push('25001629919' + '09999'); saveData(DB); });     // ancienne version : écrit lot.membres directement
await waitFor(d1.page, () => ecartsMembresLots().length === 1, { label: 'le PC détecte l\'écart' });
const ref = await d1.page.evaluate(() => [ajouterEvenementLot(DB.lots.find(x => x.id === 'LC'), 'retrait', ['25001629919' + '00003']), DB.lots.find(x => x.id === 'LC').membres.includes('25001629919' + '09999')]);
check(ref[0] && ref[0].refuse === 'ecart' && ref[1] === true, 'écart non tranché : le PC refuse d\'écrire et ne touche pas au cache');
await d1.page.evaluate(() => { integrerEcartLot('LC'); saveData(DB); });
await waitFor(d2.page, () => ecartsMembresLots().length === 0 && DB.lots.find(l => l.id === 'LC').membres.includes('25001629919' + '09999'), { label: 'le mobile converge après intégration de l\'écart' });
check(await d1.page.evaluate(() => ecartsMembresLots().length) === 0, 'plus aucun écart côté PC');
console.log('OK 4 appareil non à jour : écart détecté, écriture refusée tant qu\'il n\'est pas tranché, intégré au journal sur choix, convergence.');

// ---------- 5. suppression d'un lot : son journal disparaît partout ----------
await d1.page.evaluate(() => { DB.lots = DB.lots.filter(l => l.id !== 'LC'); DB.evenementsLots = DB.evenementsLots.filter(e => e.lotId !== 'LC'); saveData(DB); });
await waitFor(d2.page, () => !DB.lots.some(l => l.id === 'LC') && DB.evenementsLots.length === 0, { label: 'le mobile voit la suppression du lot et de son journal' });
console.log('OK 5 suppression : lot et journal supprimés sur les deux appareils.');

await d1.ctx.close(); await d2.ctx.close();
cleanup();
console.log('\nTOUS LES TESTS DE CONCURRENCE DES LOTS SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle)');
await browser.close();
