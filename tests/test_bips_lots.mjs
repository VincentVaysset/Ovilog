/* Bips différenciés dans les écrans de lot : A (trouvé, 1ère fois), B (pas
   dans le lot), C (déjà trouvé), ambigu (double bip bref) -- même mécanisme
   (wireEidLookupField + estDejaTrouve) pour l'écran de recherche d'un lot ET
   pour le bip en série du sélecteur (Nouveau lot...). Faux AudioContext qui
   relève les fréquences réellement jouées. Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

await page.evaluate(() => {
  window.__beeps = [];
  window.AudioContext = class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() {
      const o = { frequency: { value: 0 }, type: '', connect() {}, start() { window.__beeps.push(o.frequency.value); }, stop() {} };
      return o;
    }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  };
});
const A = [1046, 1568], B = [220], C = [440], AMBIGU = [700, 700];
async function scan(selector, valeur) {
  await page.evaluate(() => { window.__beeps = []; });
  await page.evaluate(({ sel, v }) => {
    const el = document.querySelector(sel);
    el.value = v;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  }, { sel: selector, v: valeur });
  await page.waitForTimeout(350);
  return await page.evaluate(() => window.__beeps.slice());
}
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

const mkBrebis = (id, eid) => ({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] });
await page.evaluate((mk) => {
  DB.brebis = [
    { id: 'b1', eid: '250016299930001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] },
    { id: 'b2', eid: '250016299830001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }, // même n° court que b1
    { id: 'b3', eid: '250016299930002', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] },
    { id: 'b4', eid: '250016299930003', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }
  ];
  DB.beliers = []; DB.agnelles = [];
  DB.lots = [{ id: 'lot-t', nom: 'Lot test', membres: ['250016299930001', '250016299830001', '250016299930002'], dateCreation: '2026-10-01' }];
  saveData(DB);
  localStorage.clear();
  currentLotId = 'lot-t'; render('lot-search');
}, null);
await page.waitForSelector('#scan-lot');

// ---- Écran de recherche d'un lot ----
let r = await scan('#scan-lot', '250016299930002');
check(eq(r, A), 'lot : 1er scan d\'une brebis du lot -> bip A, obtenu ' + JSON.stringify(r));
r = await scan('#scan-lot', '250016299930002');
check(eq(r, C), 'lot : 2e scan -> bip C seul (jamais A+C), obtenu ' + JSON.stringify(r));
r = await scan('#scan-lot', '250016299930003');
check(eq(r, B), 'lot : brebis absente du lot -> bip B, obtenu ' + JSON.stringify(r));
r = await scan('#scan-lot', '30001');
check(eq(r, AMBIGU), 'lot : numéro court ambigu -> double bip bref, obtenu ' + JSON.stringify(r));
check((await page.evaluate(() => document.getElementById('scan-feedback').textContent)).includes('Plusieurs animaux'), 'lot : liste de candidats affichée, aucune sélection automatique');
console.log('OK lot de recherche : A (1ère fois) / C seul (déjà trouvée) / B (pas dans le lot) / double bip (ambigu).');

// ---- Bip en série du sélecteur (Nouveau lot) ----
await page.evaluate(() => { render('add-lot'); });
await page.waitForSelector('.sp-mode-btn[data-mode="bip"]');
await page.click('.sp-mode-btn[data-mode="bip"]');
await page.waitForSelector('.sp-scan');
r = await scan('.sp-scan', '250016299930002');
check(eq(r, A), 'sélecteur : 1er scan -> bip A, obtenu ' + JSON.stringify(r));
r = await scan('.sp-scan', '250016299930002');
check(eq(r, C), 'sélecteur : déjà sélectionnée -> bip C SEUL (avant : A et C ensemble), obtenu ' + JSON.stringify(r));
r = await scan('.sp-scan', '250016299999999');
check(eq(r, B), 'sélecteur : EID absent de la liste -> bip B, obtenu ' + JSON.stringify(r));
r = await scan('.sp-scan', '30001');
check(eq(r, AMBIGU), 'sélecteur : ambigu -> double bip, obtenu ' + JSON.stringify(r));
console.log('OK bip en série du sélecteur : A / C seul (le double bip A+C est corrigé) / B / ambigu.');

// ---- Non-régression : un écran qui n'utilise pas l'option garde le bip A à chaque scan ----
await page.evaluate(() => { render('list'); });
await page.waitForSelector('#scan-open', { state: 'attached' });
r = await scan('#scan-open', '250016299930002'); // ouvre la fiche (navigation) : on revient à la liste pour re-scanner
await page.evaluate(() => { render('list'); });
await page.waitForSelector('#scan-open', { state: 'attached' });
const r2 = await scan('#scan-open', '250016299930002');
check(eq(r, A) && eq(r2, A), 'liste Brebis : scan répété -> toujours le bip A (comportement inchangé), obtenu ' + JSON.stringify([r, r2]));
console.log('OK non-régression : un écran sans session "trouvé" (liste Brebis) joue toujours le bip A, inchangé.');

console.log('\nTOUS LES TESTS DES BIPS DE LOT SONT PASSÉS (faux AudioContext, aucune donnée réelle)');
await browser.close();
