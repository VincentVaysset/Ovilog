/* Non-régression du résolveur partagé (numéro court / SIEOL) sur les écrans
   qui l'utilisent : écho rapide, mise bas rapide, mouvement collectif (bip en
   série). Mêmes scénarios, mêmes attendus avant ET après le chantier "SIEOL
   dans les lots" (BASE_URL permet de rejouer sur la version précédente).
   Aucune donnée réelle. */
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
const E = { x: '250016299930001', y: '250016299940002', z: '250016299950003' };
async function preparer() {
  await page.evaluate((E) => {
    const f = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }, extra || {});
    DB.brebis = [f('bx', E.x), f('by', E.y, { numeroCourtTravailSieol: '30001' }), f('bz', E.z, { numeroCourtTravailSieol: '777' })];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.campagneDebut = 2026; DB.campagneInitialisee = true; saveData(DB);
  }, E);
}
async function saisir(sel, v) {
  await page.evaluate(({ sel, v }) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, { sel, v });
  await page.waitForTimeout(250);
}
// Entre dans l'écran (l'écho rapide demande d'abord de démarrer une session).
async function entrer(route, input) {
  await page.evaluate((r) => render(r), route);
  // Une session d'écho déjà démarrée est reprise telle quelle (état de module) ;
  // sinon l'écran propose d'abord de choisir le type de session.
  if (route === 'echo-rapide' && !(await page.$(input))) {
    await page.selectOption('#f-echo-session-combo', 'constat|aucun');
    await page.click('#btn-start-echo-session');
  }
  await page.waitForSelector(input);
}
// --- écho rapide et mise bas rapide : mêmes ids d'écran, même lecture ---
for (const [route, input, ambig, nom] of [['echo-rapide', '#scan-echo', '#echo-ambigu-candidats', 'écho rapide'], ['misebas-rapide', '#scan-misebas', '#mb-ambigu-candidats', 'mise bas rapide']]) {
  await preparer();
  await entrer(route, input);
  await saisir(input, '30001'); // collision numéro court x / SIEOL y
  let n = await page.evaluate((a) => ({ chips: document.querySelectorAll(a + ' .eid-candidate-chip').length, trouvee: !!document.querySelector('.found-badge') }), ambig);
  check(n.chips === 2 && !n.trouvee, nom + ' : collision -> 2 candidats, aucune sélection automatique, obtenu ' + JSON.stringify(n));
  await entrer(route, input);
  await saisir(input, '777'); // SIEOL unique
  n = await page.evaluate(() => ({ trouvee: !!document.querySelector('.found-badge'), texte: document.getElementById('app').textContent.includes('n°50003') }));
  check(n.trouvee && n.texte, nom + ' : SIEOL unique "777" -> brebis n°50003 trouvée, obtenu ' + JSON.stringify(n));
  await entrer(route, input);
  await saisir(input, E.y);
  n = await page.evaluate(() => document.getElementById('app').textContent.includes('n°40002'));
  check(n, nom + ' : EID complet -> brebis n°40002');
  console.log('OK ' + nom + ' : collision "30001" -> 2 candidats sans sélection automatique ; SIEOL "777" -> n°50003 ; EID complet -> n°40002.');
}
// --- mouvement collectif (bip en série du sélecteur) ---
await preparer();
await page.evaluate(() => { mvMobEtat.cat = 'brebis'; render('mouvement-groupe'); });
await page.waitForSelector('label.mn-bip');
await page.click('label.mn-bip');
await page.waitForSelector('#mn-scan');
await saisir('#mn-scan', '30001');
let m = await page.evaluate(() => ({ chips: document.querySelectorAll('.mn-carte .eid-candidate-chip').length, compteur: document.getElementById('mn-compte').textContent }));
check(m.chips === 2 && /^0 sélectionné/.test(m.compteur), 'mouvement collectif : collision -> 2 candidats, rien de sélectionné, obtenu ' + JSON.stringify(m));
await saisir('#mn-scan', '777');
m = await page.evaluate(() => document.getElementById('mn-compte').textContent);
check(/^1 sélectionné/.test(m), 'mouvement collectif : SIEOL unique -> 1 sélectionnée, obtenu ' + m);
console.log('OK mouvement collectif : collision "30001" -> 2 candidats, aucune sélection automatique ; SIEOL "777" -> 1 sélectionnée.');
console.log('\nNON-RÉGRESSION DU RÉSOLVEUR PARTAGÉ OK sur écho rapide, mise bas rapide, mouvement collectif (' + BASE + ')');
await browser.close();
