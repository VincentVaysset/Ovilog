/* Teste le point 4 de la dernière demande : le nettoyage ponctuel du
   registre utilise DB.campagneDateDemarrage comme date de référence, pas la
   date du jour -- une sortie postérieure à campagneDateDemarrage (mais
   antérieure à aujourd'hui) ne doit PAS être archivée par le nettoyage
   ponctuel (elle appartient à la campagne EN COURS, pas à une campagne
   antérieure) ; une sortie antérieure à campagneDateDemarrage doit l'être.
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
const page = await browser.newPage();
await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
page.on('download', d => d.cancel().catch(() => {}));
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const email = 'nettoyage-date-ref-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';
await page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
async function waitFor(fn, { timeout = 20000, interval = 200, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(interval);
  }
  throw new Error('TIMEOUT en attendant : ' + label);
}
await waitFor(() => window.OvilogSync.getState().loggedIn, { label: 'device connecté' });

// campagneDateDemarrage volontairement DIFFÉRENTE d'aujourd'hui : simule le
// scénario réel (dernière bascule le 2026-09-29, "aujourd'hui" largement
// après dans ce test).
await page.evaluate(() => {
  DB.campagneDebut = 2026;
  DB.campagneDateDemarrage = '2026-09-29';
  DB.campagneInitialisee = true;
  DB.brebis = [
    // sortie AVANT campagneDateDemarrage -- doit être archivée.
    { id: 'avant-ref', eid: '250016210000001', statut: 'vendue', createdAt: 1, dateEntree: '2020-01-01',
      echographies: [], agnelages: [], sanitaire: [], controleLaitier: [], modesRepro: [],
      mouvements: [{ type: 'Vente', date: '2026-09-15', acheteur: 'Test' }] },
    // sortie APRÈS campagneDateDemarrage (mais avant "aujourd'hui") -- ne doit PAS être archivée
    // par le nettoyage ponctuel : elle appartient à la campagne EN COURS.
    { id: 'apres-ref', eid: '250016210000002', statut: 'morte', createdAt: 1, dateEntree: '2020-01-01',
      echographies: [], agnelages: [], sanitaire: [], controleLaitier: [], modesRepro: [],
      mouvements: [{ type: 'Morte', date: '2026-10-01', cause: 'Test' }] }
  ];
  DB.beliers = []; DB.agnelles = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
});
await page.waitForTimeout(500);

// Ouvre Paramètres > Campagne et lit le compteur affiché par le bouton de
// nettoyage ponctuel -- doit valoir 1 (seulement "avant-ref"), pas 2.
const compteurAffiche = await page.evaluate(() => {
  parametresTab = 'campagne'; parametresRubrique = 'campagne';
  render('parametres');
  const texte = document.getElementById('app').textContent;
  const m = texte.match(/(\d+) fiche\(s\) sortie\(s\) non encore archivée/);
  return m ? parseInt(m[1], 10) : null;
});
if (compteurAffiche !== 1) {
  throw new Error('FAIL point 4: le compteur du nettoyage ponctuel doit afficher 1 (seule "avant-ref" est antérieure à campagneDateDemarrage), obtenu ' + compteurAffiche);
}
console.log('OK point 4: le compteur du nettoyage ponctuel affiche bien 1 (pas 2) -- seule la sortie antérieure à campagneDateDemarrage (2026-09-29) est comptée, pas celle de la campagne en cours.');

// Lance effectivement le nettoyage (clic sur le vrai bouton) et vérifie le résultat.
const diagAvantClic = await page.evaluate(() => ({
  boutonExiste: !!document.getElementById('btn-nettoyer-registre'),
  boutonDisabled: document.getElementById('btn-nettoyer-registre') ? document.getElementById('btn-nettoyer-registre').disabled : null
}));
console.log('DIAG avant clic: ' + JSON.stringify(diagAvantClic));
await page.click('#btn-nettoyer-registre');
await page.waitForTimeout(1000);
const diagApresClic = await page.evaluate(() => ({
  statusTexte: document.getElementById('nettoyage-registre-status') ? document.getElementById('nettoyage-registre-status').textContent : null,
  brebisRestantes: DB.brebis.map(s => s.id)
}));
console.log('DIAG apres clic (1s): ' + JSON.stringify(diagApresClic));
await waitFor(() => {
  const el = document.getElementById('nettoyage-registre-status');
  return el && el.textContent.length > 0;
}, { timeout: 15000, label: 'le nettoyage ponctuel se termine' });
const etatFinal = await page.evaluate(() => ({
  avantRefEncorePresente: DB.brebis.some(s => s.id === 'avant-ref'),
  apresRefEncorePresente: DB.brebis.some(s => s.id === 'apres-ref'),
  avantRefDansRegistre: !!(DB.registre.brebis && DB.registre.brebis['250016210000001']),
  statusTexte: document.getElementById('nettoyage-registre-status').textContent
}));
if (etatFinal.avantRefEncorePresente) throw new Error('FAIL point 4: "avant-ref" (sortie antérieure à campagneDateDemarrage) doit avoir été archivée et retirée.');
if (!etatFinal.avantRefDansRegistre) throw new Error('FAIL point 4: "avant-ref" doit être dans le registre après le nettoyage.');
if (!etatFinal.apresRefEncorePresente) throw new Error('FAIL point 4: "apres-ref" (sortie de la campagne EN COURS) ne doit JAMAIS être touchée par le nettoyage ponctuel, obtenu statut texte: ' + etatFinal.statusTexte);
console.log('OK point 4: le nettoyage ponctuel (bouton réel) archive bien "avant-ref" (antérieure à campagneDateDemarrage) et laisse intacte "apres-ref" (sortie de la campagne en cours) -- statut affiché : "' + etatFinal.statusTexte + '"');

cleanup();
console.log('\nTOUS LES TESTS DE LA DATE DE RÉFÉRENCE DU NETTOYAGE SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle)');
await browser.close();
