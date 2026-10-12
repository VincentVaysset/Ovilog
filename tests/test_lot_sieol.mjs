/* Recherche par numéro SIEOL dans les lots : en plus de l'EID complet et du
   numéro court (5 derniers chiffres), la recherche d'un lot reconnaît
   numeroCourtTravailSieol et numeroLongTravailSieol des fiches. Collision
   numéro court / SIEOL = liste de candidats + bip ambigu, jamais de sélection
   automatique. Un n° SIEOL d'un animal HORS du lot = bip "pas dans le lot".
   Faux AudioContext. Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const BASE = process.env.BASE_URL || URL_APP;
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(300);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
await page.evaluate(() => {
  window.__beeps = [];
  window.AudioContext = class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() { const o = { frequency: { value: 0 }, type: '', connect() {}, start() { window.__beeps.push(o.frequency.value); }, stop() {} }; return o; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  };
});
const A = [1046, 1568], B = [220], C = [440], AMBIGU = [700, 700];
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const E = { x: '250016299930001', y: '250016299940002', z: '250016299950003', w: '250016299960004', hors: '250016299970005' };
await page.evaluate((E) => {
  const f = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }, extra || {});
  DB.brebis = [
    f('bx', E.x),                                                    // n° court 30001
    f('by', E.y, { numeroCourtTravailSieol: '30001' }),              // SIEOL court = n° court de x : collision
    f('bz', E.z, { numeroCourtTravailSieol: '777' }),                // SIEOL court unique
    f('bw', E.w, { numeroLongTravailSieol: '250043' }),              // SIEOL long unique
    f('bh', E.hors, { numeroCourtTravailSieol: '888' })              // hors du lot
  ];
  DB.beliers = []; DB.agnelles = [];
  DB.lots = [{ id: 'lot-s', nom: 'Lot SIEOL', membres: [E.x, E.y, E.z, E.w], dateCreation: '2026-10-01' }];
  saveData(DB);
  localStorage.removeItem('ovilog_lot_trouvees_lot-s');
  currentLotId = 'lot-s'; render('lot-search');
}, E);
await page.waitForSelector('#scan-lot');
async function scan(v) {
  await page.evaluate(() => { window.__beeps = []; });
  await page.evaluate((v) => { const el = document.getElementById('scan-lot'); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, v);
  await page.waitForTimeout(350);
  return await page.evaluate(() => ({ beeps: window.__beeps.slice(), cochees: [...document.querySelectorAll('.lot-check')].filter(c => c.checked).map(c => c.dataset.eid), feedback: document.getElementById('scan-feedback').textContent, compteur: document.getElementById('lot-compteur').textContent }));
}

// SIEOL court unique
let r = await scan('777');
check(eq(r.beeps, A) && r.cochees.includes(E.z) && r.compteur === '1 / 4 trouvée(s)', 'n° SIEOL court unique -> trouvée (bip A, ligne cochée), obtenu ' + JSON.stringify(r));
// SIEOL long unique
r = await scan('250043');
check(eq(r.beeps, A) && r.cochees.includes(E.w), 'n° SIEOL long unique -> trouvée, obtenu ' + JSON.stringify(r));
// même animal par un autre moyen : bip C
r = await scan('777');
check(eq(r.beeps, C), 'SIEOL d\'une brebis déjà trouvée -> bip C, obtenu ' + JSON.stringify(r.beeps));
console.log('OK SIEOL court (777) et long (250043) : brebis trouvée, ligne cochée ; re-scan = bip C.');
// EID complet et numéro court continuent de fonctionner
r = await scan(E.y);
check(eq(r.beeps, A) && r.cochees.includes(E.y), 'EID complet toujours reconnu, obtenu ' + JSON.stringify(r));
console.log('OK EID complet inchangé.');
// Collision : '30001' = n° court de x ET SIEOL court de y -> ambigu, jamais de sélection automatique
const avant = (await scan('99999')).cochees.length; // absent (B), remet l'état
r = await scan('30001');
check(eq(r.beeps, AMBIGU) && /Plusieurs animaux/.test(r.feedback) && r.cochees.length === avant, 'collision n° court/SIEOL -> double bip + candidats, aucune ligne cochée automatiquement, obtenu ' + JSON.stringify(r));
const chips = await page.evaluate(() => document.querySelectorAll('#scan-feedback .eid-candidate-chip').length);
check(chips === 2, '2 candidats attendus, obtenu ' + chips);
await page.evaluate(() => document.querySelector('#scan-feedback .eid-candidate-chip').click());
await page.waitForTimeout(250);
const apresChoix = await page.evaluate(() => [...document.querySelectorAll('.lot-check')].filter(c => c.checked).map(c => c.dataset.eid));
check(apresChoix.includes(E.x), 'le choix explicite d\'un candidat coche bien la ligne, obtenu ' + JSON.stringify(apresChoix));
console.log('OK collision : "30001" est à la fois le n° court de x et le SIEOL de y -> double bip + 2 candidats, aucune sélection automatique ; le clic sur un candidat coche sa ligne.');
// SIEOL d'un animal hors du lot
r = await scan('888');
check(eq(r.beeps, B) && /pas dans ce lot/.test(r.feedback), 'SIEOL d\'un animal hors du lot -> bip B, obtenu ' + JSON.stringify(r));
console.log('OK SIEOL d\'un animal hors du lot -> bip B "n\'est pas dans ce lot".');
console.log('\nTOUS LES TESTS SIEOL DES LOTS SONT PASSÉS (faux AudioContext, aucune donnée réelle)');
await browser.close();
