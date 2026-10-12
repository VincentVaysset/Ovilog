/* Tableau "Mises bas de la campagne" (Mise bas en série) : nombres d'agneaux
   mâles / femelles / mort-nés par ligne (zéro = "–"), colonne Total par ligne
   inchangée, ligne de totaux en pied = somme des lignes. Affichage seulement :
   aucune donnée d'agnelage modifiée. Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

// portées : [n° court affiché, date, sexes des agneaux] -> attendu [M, F, MN, total]
const cas = [
  ['101', '2026-10-05', ['Mâle'], [1, 0, 0, 1]],                                   // portée simple, 1 mâle
  ['102', '2026-10-04', ['Mâle', 'Femelle'], [1, 1, 0, 2]],                        // double M + F
  ['103', '2026-10-03', ['Femelle', 'Femelle'], [0, 2, 0, 2]],                     // double de même sexe
  ['104', '2026-10-02', ['Mort-né'], [0, 0, 1, 1]],                                // mort-né seul
  ['105', '2026-10-01', ['Mâle', 'Femelle', 'Mort-né'], [1, 1, 1, 3]],             // triple avec un mort-né
  ['106', '2026-09-30', ['Mâle', 'Mâle', 'Femelle', 'Femelle'], [2, 2, 0, 4]]      // quadruple
];
await page.evaluate((cas) => {
  const f = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }, extra || {});
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.brebis = cas.map(([court, date, sexes], i) => f('b' + i, '2500162999' + (3 + (i % 5)) + '000' + i, {
    numeroCourtTravailSieol: court,
    agnelages: [{ date, campagne: 2026, lambs: sexes.map(s => ({ sexe: s })), codeRepro: 'MN' }]
  }));
  DB.beliers = []; DB.agnelles = []; saveData(DB);
  window.__avant = JSON.stringify(DB.brebis);
  render('misebas-rapide');
}, cas);
await page.waitForSelector('table');

const lu = await page.evaluate(() => {
  const txt = td => { const t = td.textContent.trim(); return t === '–' ? 0 : parseInt(t, 10); };
  const rows = [...document.querySelectorAll('table tr')].slice(1);
  const lignes = rows.filter(tr => tr.id !== 'mb-totaux').map(tr => { const td = tr.querySelectorAll('td'); return { court: td[0].textContent.trim(), cells: [txt(td[2]), txt(td[3]), txt(td[4]), txt(td[5])], brut: [td[2], td[3], td[4]].map(x => x.textContent.trim()), annuler: !!tr.querySelector('.btn-annuler-mb-campagne') }; });
  const tot = document.getElementById('mb-totaux');
  const tt = tot.querySelectorAll('td');
  return {
    entetes: [...document.querySelectorAll('table tr')[0].querySelectorAll('th')].map(t => t.textContent.trim()),
    lignes, totaux: [txt(tt[1]), txt(tt[2]), txt(tt[3]), txt(tt[4])], libelleTotaux: tt[0].textContent.trim(),
    html: document.querySelector('table').innerHTML
  };
});
check(lu.entetes.includes('Mâles') && lu.entetes.includes('Femelles') && lu.entetes.includes('Mort-nés') && lu.entetes.includes('Total'), 'entêtes au pluriel attendus, obtenu ' + JSON.stringify(lu.entetes));
check(!/✕/.test(lu.html), 'plus aucune case cochée (✕) dans le tableau');
for (const [court, , , attendu] of cas) {
  const l = lu.lignes.find(x => x.court === court);
  check(l && JSON.stringify(l.cells) === JSON.stringify(attendu), 'ligne ' + court + ' : attendu ' + JSON.stringify(attendu) + ', obtenu ' + JSON.stringify(l && l.cells));
  check(l.cells[0] + l.cells[1] + l.cells[2] === l.cells[3], 'ligne ' + court + ' : mâles + femelles + mort-nés = total');
  check(l.annuler, 'ligne ' + court + ' : bouton Annuler conservé');
}
console.log('OK lignes : simple (1/–/–/1), double M+F (1/1/–/2), double F+F (–/2/–/2), mort-né seul (–/–/1/1), triple avec mort-né (1/1/1/3), quadruple (2/2/–/4) ; total = M+F+MN sur chaque ligne.');
const l1 = lu.lignes.find(x => x.court === '101');
check(JSON.stringify(l1.brut) === JSON.stringify(['1', '–', '–']), 'zéro affiché "–", obtenu ' + JSON.stringify(l1.brut));
console.log('OK zéro : affiché "–" (portée simple : "1", "–", "–").');
const sommes = [0, 1, 2, 3].map(i => lu.lignes.reduce((a, l) => a + l.cells[i], 0));
check(JSON.stringify(lu.totaux) === JSON.stringify(sommes), 'ligne de totaux = somme des lignes : attendu ' + JSON.stringify(sommes) + ', obtenu ' + JSON.stringify(lu.totaux));
check(JSON.stringify(lu.totaux) === JSON.stringify([5, 6, 2, 13]), 'totaux attendus [5,6,2,13] (calculés à la main depuis les portées), obtenu ' + JSON.stringify(lu.totaux));
check(/6 mises bas/.test(lu.libelleTotaux), 'libellé de la ligne de totaux : ' + lu.libelleTotaux);
console.log('OK totaux en pied : ' + JSON.stringify(lu.totaux) + ' = somme des lignes = calcul à la main (5 mâles, 6 femelles, 2 mort-nés, 13 agneaux) ; "' + lu.libelleTotaux + '".');
const apres = await page.evaluate(() => JSON.stringify(DB.brebis));
check(apres === await page.evaluate(() => window.__avant), 'les agnelages stockés ne doivent pas changer (affichage seulement)');
console.log('OK données : agnelages strictement inchangés.');
console.log('\nTOUS LES TESTS DU TABLEAU DES MISES BAS SONT PASSÉS (aucune donnée réelle)');
await browser.close();
