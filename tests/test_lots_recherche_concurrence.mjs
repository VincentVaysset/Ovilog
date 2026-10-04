/* Lots échographies, partie 2 : CONCURRENCE PC / mobile sur un lot de RECHERCHE ou de RÉFORME (désormais journalisés, collection evenementsLots), avec le VRAI code de
   synchro (faux backend Firestore local, compte jetable, aucune donnée réelle) : création vide puis affectation progressive depuis le PC pendant que le mobile ajuste le même lot
   (écran « Modifier », par différences), retrait PC + ajout mobile simultanés, brebis vendue jamais retirée en silence, 0 membre refusé sur mobile, appareil non à jour détecté,
   suppression d'un lot avec son journal. */
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



const email = 'lots-recherche-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';
const eid = n => '25001629919' + String(n).padStart(5, '0');
const membres = (page, id) => page.evaluate(i => DB.lots.find(l => l.id === i).membres.map(cleanEid).sort().join(','), id);
const attendu = ns => ns.map(n => eid(n)).sort().join(',');
async function attendreCloud(page, lotId, n) {
  const uid = await page.evaluate(() => localStorage.getItem('ovilog_sync_bootstrapped_uid'));
  for (let k = 0; k < 100; k++) {
    const sn = await (await fetch('http://localhost:' + fakePort + '/snapshot?uid=' + uid + '&col=evenementsLots')).json();
    if (Object.values(sn.docs).filter(d => d.lotId === lotId).length >= n) return;
    await page.waitForTimeout(200);
  }
  throw new Error('TIMEOUT : le cloud n\'a pas reçu ' + n + ' événements du lot ' + lotId);
}
const plage = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const d1 = await newDevicePage(true);          // PC
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
await d1.page.evaluate(() => {
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.beliers = []; DB.agnelles = [];
  DB.brebis = Array.from({ length: 30 }, (_, i) => ({ id: 'b' + (i + 1), eid: '25001629919' + String(i + 1).padStart(5, '0'), statut: 'active', agnelages: [], modesRepro: [], videesDefinitives: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], echographies: [], controleLaitier: [] }));
  creerLotJournalise({ id: 'LR', nom: 'Doubles à suivre', dateCreation: '2026-10-03' }, []);                 // lot de recherche, créé VIDE
  creerLotJournalise({ id: 'LF', nom: 'Réforme du 03-10-2026', dateCreation: '2026-10-03', type: 'reforme' }, []);
  window.rows = (a, b) => DB.brebis.slice(a - 1, b).map(s => ({ eid: s.eid, obj: s }));
  saveData(DB);
});
await d1.page.waitForTimeout(600);
const d2 = await newDevicePage(false);         // mobile
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'mobile connecté' });
await waitFor(d2.page, () => DB.lots.some(l => l.id === 'LR') && DB.lots.some(l => l.id === 'LF') && DB.brebis.length === 30, { label: 'le mobile reçoit les 2 lots vides et les brebis' });
const etat = await d2.page.evaluate(() => DB.lots.filter(l => l.id === 'LR' || l.id === 'LF').map(l => [l.id, l.journal, l.membres.length, l.type || null, l.membres === undefined]));
check(JSON.stringify(etat) === JSON.stringify([['LR', 1, 0, null, false], ['LF', 1, 0, 'reforme', false]]), 'lots de recherche / réforme créés vides et journalisés, reçus par le mobile : ' + JSON.stringify(etat));
const snap = await (await fetch('http://localhost:' + fakePort + '/snapshot?uid=' + await d1.page.evaluate(() => localStorage.getItem('ovilog_sync_bootstrapped_uid')) + '&col=meta')).json();
check(snap.data.lots.every(l => l.membres === undefined && l.membresEmpreinte === undefined), 'le cache des membres n\'est jamais envoyé dans meta.lots (recherche / réforme comprises)');
console.log('OK (infra) : lots de recherche et de réforme vides, journalisés, synchronisés ; aucun cache de membres envoyé au cloud.');

// ---------- 1. affectation progressive depuis le PC ----------
await d1.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LR'); affecterAuLotPc(l, rows(1, 10)); saveData(DB); });
await waitFor(d2.page, () => DB.lots.find(l => l.id === 'LR').membres.length === 10, { label: 'le mobile reçoit les 10 premières brebis' });
check(await membres(d1.page, 'LR') === await membres(d2.page, 'LR') && await membres(d2.page, 'LR') === attendu(plage(1, 10)), 'affectation PC reçue sur mobile');
console.log('OK 1 affectation depuis le PC (lot de recherche) : reçue sur mobile.');

// ---------- 2. le mobile ajuste le même lot (écran Modifier) PENDANT que le PC poursuit l'affectation ----------
await d2.page.evaluate(() => { currentLotId = 'LR'; render('edit-lot'); });
await d2.page.waitForSelector('#edit-lot-picker .sp-check');
await d2.page.route('**/snapshot*', r => r.abort());                            // le mobile ne reçoit rien pendant un moment (réseau lent / hors ligne) : son écran reste sur l'état d'ouverture
await d1.page.evaluate(() => { affecterAuLotPc(DB.lots.find(x => x.id === 'LR'), rows(11, 20)); saveData(DB); });
await attendreCloud(d1.page, 'LR', 2);                                     // l'événement du PC est bien parti vers le cloud (le mobile, lui, ne l'a pas encore reçu)
await d2.page.evaluate(() => { document.querySelector('.sp-check[data-id="b25"]').click(); });
await d2.page.click('#btn-save-edit-lot');
check(await membres(d2.page, 'LR') === attendu([...plage(1, 10), 25]), 'mobile, avant réception : sa propre modification est appliquée (ajout de n°25)');
await d2.page.unroute('**/snapshot*');                                          // le réseau revient
await waitFor(d1.page, () => DB.lots.find(l => l.id === 'LR').membres.length === 21, { label: 'le PC reçoit l\'ajout mobile' });
await waitFor(d2.page, () => DB.lots.find(l => l.id === 'LR').membres.length === 21, { label: 'le mobile reçoit les 10 brebis du PC' });
const f2 = [await membres(d1.page, 'LR'), await membres(d2.page, 'LR')];
check(f2[0] === f2[1] && f2[0] === attendu([...plage(1, 20), 25]), 'PC (11 à 20) et mobile (25) en même temps : rien de perdu, états identiques : ' + f2.join(' | '));
check(await d1.page.evaluate(() => ecartsMembresLots().length) === 0 && await d2.page.evaluate(() => ecartsMembresLots().length) === 0, 'aucun écart signalé');
const evs = await d2.page.evaluate(() => evenementsDuLot('LR').map(e => [e.type, e.eids.length, e.source]));
check(JSON.stringify(evs) === JSON.stringify([['affectation', 10, 'PC'], ['affectation', 10, 'PC'], ['affectation', 1, 'mobile']]), 'journal : 3 événements (10 PC, 10 PC, 1 mobile) : ' + JSON.stringify(evs));
console.log('OK 2 édition mobile (par différences) pendant l\'affectation PC : les deux sont conservés, journal tracé (source PC / mobile).');

// ---------- 3. différences par rapport à l'ouverture de l'écran (fonction) ----------
const diff = await d2.page.evaluate(() => {
  const l = DB.lots.find(x => x.id === 'LR');
  const ouverture = l.membres.slice();                                          // l'écran s'est ouvert avec ces membres
  ajouterEvenementLot(l, 'affectation', ['25001629919' + '00028']);              // un autre appareil ajoute n°28 entre-temps
  ajouterEvenementLot(l, 'retrait', ['25001629919' + '00001']);                  // et retire n°1
  const finaux = ouverture.filter(e => cleanEid(e) !== '25001629919' + '00002').concat(['25001629919' + '00029']);   // l'écran retire n°2 et ajoute n°29
  const ok = appliquerDiffMembresLot(l, ouverture, finaux);
  return { ok, m: l.membres.map(cleanEid).sort().join(',') };
});
const attDiff = [...plage(1, 20), 25, 28, 29].filter(n => n !== 1 && n !== 2);
check(diff.ok && diff.m === attendu(attDiff), 'seules les différences de l\'écran sont appliquées (retrait n°2, ajout n°29) : n°28 (ajouté ailleurs) conservé, n°1 (retiré ailleurs) reste retiré : ' + diff.m);
await d2.page.evaluate(() => saveData(DB));
await waitFor(d1.page, () => DB.lots.find(l => l.id === 'LR').membres.map(cleanEid).includes('25001629919' + '00029') && !DB.lots.find(l => l.id === 'LR').membres.map(cleanEid).includes('25001629919' + '00002'), { label: 'le PC reçoit' });
check(await membres(d1.page, 'LR') === await membres(d2.page, 'LR'), 'PC et mobile identiques');
console.log('OK 3 appliquerDiffMembresLot : jamais l\'état complet, seulement ce que l\'écran a changé.');

// ---------- 4. brebis vendue : jamais retirée en silence par l'édition mobile ; 0 membre refusé ----------
await d1.page.evaluate(() => { affecterAuLotPc(DB.lots.find(x => x.id === 'LF'), rows(30, 30)); DB.brebis[29].statut = 'vendu'; saveData(DB); });
await waitFor(d2.page, () => DB.lots.find(l => l.id === 'LF').membres.length === 1 && DB.brebis[29].statut === 'vendu', { label: 'le mobile reçoit le lot de réforme et la vente' });
await d2.page.evaluate(() => { currentLotId = 'LF'; render('edit-lot'); });
await d2.page.waitForSelector('#edit-lot-picker .sp-check');
await d2.page.evaluate(() => { document.querySelector('.sp-check[data-id="b3"]').click(); document.getElementById('btn-save-edit-lot').click(); });
check(await membres(d2.page, 'LF') === attendu([3, 30]), 'la brebis vendue (n°30) reste dans le lot de réforme après une édition mobile, n°3 ajoutée : ' + await membres(d2.page, 'LF'));
await d2.page.evaluate(() => { currentLotId = 'LR'; render('edit-lot'); });
await d2.page.waitForSelector('#edit-lot-picker .sp-check');
const refus0 = await d2.page.evaluate(() => { document.querySelectorAll('.sp-check:checked').forEach(c => c.click()); document.getElementById('btn-save-edit-lot').click(); const e = document.getElementById('err'); return e && !e.classList.contains('hidden') ? e.textContent : null; });
check(/au moins un membre/.test(refus0 || '') && await d2.page.evaluate(() => DB.lots.find(l => l.id === 'LR').membres.length) === attDiff.length, 'l\'édition mobile refuse 0 membre (message), rien n\'est retiré');
console.log('OK 4 brebis vendue conservée par l\'édition mobile ; 0 membre refusé (la suppression passe par « Suppr. » avec confirmation).');

// ---------- 5. retrait PC + ajout mobile (bip) sur le même lot de réforme ----------
await d2.page.evaluate(() => render('lots'));
await Promise.all([
  d1.page.evaluate(() => { retirerDuLotPc(DB.lots.find(x => x.id === 'LF'), '25001629919' + '00003'); saveData(DB); }),
  d2.page.evaluate(() => { ajouterEvenementLot(DB.lots.find(x => x.id === 'LF'), 'affectation', ['25001629919' + '00004']); saveData(DB); })
]);
await waitFor(d1.page, () => DB.evenementsLots.filter(e => e.lotId === 'LF').length === 4, { label: 'PC reçoit' });
await waitFor(d2.page, () => DB.evenementsLots.filter(e => e.lotId === 'LF').length === 4, { label: 'mobile reçoit' });
await d1.page.waitForTimeout(500);
check(await membres(d1.page, 'LF') === await membres(d2.page, 'LF') && await membres(d1.page, 'LF') === attendu([4, 30]), 'retrait PC (n°3) + ajout mobile (n°4) simultanés : {4, 30} des deux côtés : ' + await membres(d1.page, 'LF'));
console.log('OK 5 retrait PC + ajout mobile simultanés sur le même lot de réforme : conservés.');

// ---------- 6. appareil non à jour : écriture directe de lot.membres détectée ----------
const uid = await d1.page.evaluate(() => localStorage.getItem('ovilog_sync_bootstrapped_uid'));
const snap2 = await (await fetch('http://localhost:' + fakePort + '/snapshot?uid=' + uid + '&col=meta')).json();
const mem = await d1.page.evaluate(() => DB.lots.find(l => l.id === 'LR').membres.slice());
await fetch('http://localhost:' + fakePort + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops: [{ type: 'update', path: 'users/' + uid + '/meta/main', data: { lots: snap2.data.lots.map(l => l.id === 'LR' ? Object.assign({}, l, { membres: [...mem, eid(9999)] }) : l) } }] }) });
await waitFor(d1.page, () => ecartsMembresLots().length === 1, { label: 'le PC détecte l\'écart sur le lot de recherche' });
const ref = await d1.page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LR'); return [affecterAuLotPc(l, rows(26, 27)), l.membres.map(cleanEid).includes('25001629919' + '09999')]; });
check(ref[0] === -1 && ref[1] === true, 'écart non tranché : l\'affectation PC est refusée, rien n\'est écrasé');
await d1.page.evaluate(() => { integrerEcartLot('LR'); saveData(DB); });
await waitFor(d2.page, () => ecartsMembresLots().length === 0 && DB.lots.find(l => l.id === 'LR').membres.map(cleanEid).includes('25001629919' + '09999'), { label: 'convergence après intégration' });
console.log('OK 6 appareil non à jour (lot de recherche) : écart détecté, écriture refusée, intégré sur choix, convergence.');

// ---------- 7. suppression : lot et journal partout ----------
await d1.page.evaluate(() => { ['LR', 'LF'].forEach(id => { DB.lots = DB.lots.filter(l => l.id !== id); DB.evenementsLots = DB.evenementsLots.filter(e => e.lotId !== id); }); saveData(DB); });
await waitFor(d2.page, () => !DB.lots.some(l => l.id === 'LR' || l.id === 'LF') && DB.evenementsLots.length === 0, { label: 'le mobile voit les suppressions' });
console.log('OK 7 suppression : lots et journaux supprimés sur les deux appareils.');

await d1.ctx.close(); await d2.ctx.close();
cleanup();
console.log('\nTOUS LES TESTS DE CONCURRENCE DES LOTS DE RECHERCHE ET DE RÉFORME SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle)');
await browser.close();
