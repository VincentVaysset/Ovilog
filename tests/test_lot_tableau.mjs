/* Lot de recherche en tableau : une ligne par membre (n° 5 chiffres, n° SIEOL
   si présent), tri par âge puis numéro, case cochée à la détection (scan par
   EID ou numéro court), décochage réversible, compteur "trouvées / total",
   "Remettre à zéro" avec confirmation, état stocké en localStorage par id de
   lot (survit à un rechargement), jamais dans DB, jamais de saveData.
   Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
let reponseConfirm = true;
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => { if (d.type() === 'confirm') { reponseConfirm ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

const M = { m1: '250016299930005', m2: '250016299910002', m3: '250016299910001', m4: '250016299950003', m5: '250016299930001' };
const fiche = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }, extra || {});
async function preparer(avecSieol) {
  await page.evaluate(({ M, avecSieol }) => {
    const f = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }, extra || {});
    DB.brebis = [f('b1', M.m1), f('b2', M.m2, avecSieol ? { numeroCourtTravailSieol: '543' } : {}), f('b3', M.m3), f('b4', M.m4), f('b5', M.m5)];
    DB.beliers = []; DB.agnelles = [];
    DB.lots = [{ id: 'lot-t', nom: 'Lot test', membres: [M.m1, M.m2, M.m3, M.m4, M.m5], dateCreation: '2026-10-01' }];
    saveData(DB);
    localStorage.removeItem('ovilog_lot_trouvees_lot-t');
    window.__saveCalls = 0;
    const orig = saveData;
    saveData = function (...a) { window.__saveCalls++; return orig.apply(this, a); };
    currentLotId = 'lot-t'; render('lot-search');
  }, { M, avecSieol });
  await page.waitForSelector('#scan-lot');
}
const etat = () => page.evaluate(() => ({
  compteur: document.getElementById('lot-compteur').textContent,
  ordre: [...document.querySelectorAll('.lot-ligne')].map(tr => tr.querySelector('td:nth-child(2)').textContent.trim()),
  cochees: [...document.querySelectorAll('.lot-check')].filter(c => c.checked).map(c => c.dataset.eid),
  fond: [...document.querySelectorAll('.lot-ligne')].filter(tr => tr.style.background).map(tr => tr.dataset.eid),
  entetes: [...document.querySelectorAll('th')].map(t => t.textContent.trim())
}));
const scan = async (v) => {
  await page.evaluate((v) => { const el = document.getElementById('scan-lot'); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, v);
  await page.waitForTimeout(150);
};
const stocke = () => page.evaluate(() => localStorage.getItem('ovilog_lot_trouvees_lot-t'));

// ---- Tableau, tri, compteur initial ----
await preparer(false);
let e = await etat();
check(JSON.stringify(e.ordre) === JSON.stringify(['n°10001', 'n°10002', 'n°30001', 'n°30005', 'n°50003']), 'tri par âge (plus vieux d\'abord) puis numéro, obtenu ' + JSON.stringify(e.ordre));
check(e.compteur === '0 / 5 trouvée(s)' && e.cochees.length === 0, 'compteur initial 0 / 5, obtenu ' + e.compteur);
check(!e.entetes.includes('N° SIEOL'), 'sans n° SIEOL sur aucun membre, la colonne SIEOL ne doit pas apparaître');
console.log('OK tableau : tri âge puis numéro =', e.ordre.join(' '), '; compteur "0 / 5 trouvée(s)" ; pas de colonne SIEOL quand aucun membre n\'en a.');

// ---- Scan par EID complet puis par numéro court : la ligne se coche ----
const dbAvant = await page.evaluate(() => localStorage.getItem(DB_KEY));
await scan(M.m5);
e = await etat();
check(e.compteur === '1 / 5 trouvée(s)' && JSON.stringify(e.cochees) === JSON.stringify([M.m5]) && JSON.stringify(e.fond) === JSON.stringify([M.m5]), 'scan EID : ligne cochée + surlignée + compteur 1/5, obtenu ' + JSON.stringify(e));
await scan('30005');
e = await etat();
check(e.compteur === '2 / 5 trouvée(s)' && e.cochees.includes(M.m1), 'scan par numéro court : ligne cochée, compteur 2/5');
check(JSON.stringify(e.ordre) === JSON.stringify(['n°10001', 'n°10002', 'n°30001', 'n°30005', 'n°50003']), 'l\'ordre ne doit jamais changer quand on coche');
console.log('OK scan : EID complet puis numéro court -> lignes cochées/surlignées, compteur 2 / 5, ordre inchangé.');

// ---- Décochage réversible ----
await page.click('.lot-check[data-eid="' + M.m5 + '"]');
e = await etat();
check(e.compteur === '1 / 5 trouvée(s)' && !e.cochees.includes(M.m5) && !e.fond.includes(M.m5), 'décocher : ligne décochée, compteur 1/5');
check(JSON.parse(await stocke()).length === 1, 'décocher : état stocké mis à jour');
await page.click('.lot-check[data-eid="' + M.m5 + '"]');
e = await etat();
check(e.compteur === '2 / 5 trouvée(s)' && e.cochees.includes(M.m5), 'recocher : action réversible');
console.log('OK décochage : réversible (compteur 2 -> 1 -> 2), état stocké suivi.');

// ---- Rien dans DB, rien de synchronisé ----
check((await page.evaluate(() => window.__saveCalls)) === 0, 'aucun saveData ne doit être appelé par scans/cases');
check((await page.evaluate(() => localStorage.getItem(DB_KEY))) === dbAvant, 'DB stockée strictement inchangée');
check(JSON.stringify(await page.evaluate(() => DB.lots[0].membres)) === JSON.stringify(Object.values(M)), 'contenu du lot inchangé');
console.log('OK isolation : 0 appel à saveData, DB stockée identique, contenu du lot inchangé (donc rien à synchroniser).');

// ---- Survie à un rechargement ----
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);
await page.evaluate(() => { currentLotId = 'lot-t'; render('lot-search'); });
await page.waitForSelector('#scan-lot');
e = await etat();
check(e.compteur === '2 / 5 trouvée(s)' && e.cochees.includes(M.m5) && e.cochees.includes(M.m1), 'après rechargement : état conservé, obtenu ' + JSON.stringify(e));
console.log('OK rechargement : l\'état "trouvé" est conservé (2 / 5, mêmes lignes cochées).');

// ---- Remettre à zéro : refus puis confirmation ----
reponseConfirm = false;
await page.click('#btn-reset-lot-trouvees');
e = await etat();
check(e.compteur === '2 / 5 trouvée(s)', 'refus de la confirmation : rien ne change');
reponseConfirm = true;
await page.click('#btn-reset-lot-trouvees');
e = await etat();
check(e.compteur === '0 / 5 trouvée(s)' && e.cochees.length === 0 && (await stocke()) === null, 'confirmation : tout est remis à zéro, clé effacée');
console.log('OK remise à zéro : refus = rien ne change ; confirmation = 0 / 5 et état stocké effacé.');

// ---- Colonne SIEOL quand un membre en a un ----
await preparer(true);
e = await etat();
check(e.entetes.includes('N° SIEOL'), 'colonne SIEOL attendue quand un membre a un numéro');
const sieolCell = await page.evaluate(() => document.querySelector('.lot-ligne[data-eid="250016299910002"] td:nth-child(3)').textContent.trim());
check(sieolCell === '543', 'n° SIEOL affiché pour le membre concerné, obtenu ' + sieolCell);
console.log('OK SIEOL : colonne affichée uniquement quand au moins un membre a un numéro (543 pour le n°10002).');

// ---- Suppression du lot et régénération d'un lot auto : état effacé ----
await scan(M.m3);
check((await stocke()) !== null, 'état stocké avant suppression');
await page.evaluate(() => { render('lots'); });
await page.waitForSelector('.btn-del-lot');
await page.click('.btn-del-lot[data-id="lot-t"]');
await page.waitForTimeout(150);
check((await stocke()) === null, 'suppression du lot : état stocké effacé');
await page.evaluate((M) => {
  localStorage.setItem('ovilog_lot_trouvees_lot-auto', JSON.stringify([M.m1]));
  openAutoLot('lot-auto', 'Auto test', [M.m1, M.m2]);
}, M);
check((await page.evaluate(() => localStorage.getItem('ovilog_lot_trouvees_lot-auto'))) === null, 'lot automatique régénéré : état précédent effacé');
console.log('OK nettoyage : suppression d\'un lot et régénération d\'un lot automatique effacent l\'état stocké.');

console.log('\nTOUS LES TESTS DU LOT EN TABLEAU SONT PASSÉS (aucune donnée réelle)');
await browser.close();
