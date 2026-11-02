/* Écran Mises-bas (mobile et PC) : toutes les mises bas de la campagne, dans l'ORDRE D'ENREGISTREMENT (saisieA, à la milliseconde),
   la dernière saisie en haut, même si sa date de mise bas est plus ancienne ; les mises bas d'avant l'horodatage (sans saisieA) viennent
   après, date la plus récente puis n° croissant. Mobile : plus de limite à 5 lignes. Une modification garde l'instant d'origine.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await p.clock.install({ time: new Date('2026-11-20T08:00:00') });
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.clock.runFor(500);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = n => ({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(fiche); DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    // mises bas d'avant l'horodatage (sans saisieA) : n°69008 et n°69009, même jour
    DB.brebis[8].agnelages = [{ date: '2026-11-10', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mort-né', adopte: false }] }];
    DB.brebis[7].agnelages = [{ date: '2026-11-10', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mort-né', adopte: false }] }];
  });
  // saisies dans l'ordre 69003, 69001, 69007 (date plus ancienne), 69002, 69004, 69005, 69006, une seconde d'écart
  for (const [n, date] of [[3, '2026-11-19'], [1, '2026-11-19'], [7, '2026-11-15'], [2, '2026-11-20'], [4, '2026-11-20'], [5, '2026-11-20'], [6, '2026-11-20']]) {
    await p.evaluate(([n, date]) => { const b = DB.brebis[n - 1], r = construireAgnelageMiseBas(b, { date, codeRepro: 'MN', lambs: [{ sexe: 'Mort-né' }] }); enregistrerMiseBas(b, r.agnelage); }, [n, date]);
    await p.clock.runFor(1000);
  }
  const attendu = ['69006', '69005', '69004', '69002', '69007', '69001', '69003', '69008', '69009'];
  eq(await p.evaluate(() => misebasCampagneRows().map(r => r.numero)), attendu, nom + ' : ordre d\'enregistrement, dernière saisie en haut ; anciennes (sans heure) après, par n°');
  check(await p.evaluate(() => DB.brebis.slice(0, 7).every(b => typeof b.agnelages[0].saisieA === 'number')), nom + ' : instant de saisie enregistré');
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.clock.runFor(300);
  if (!bureau) eq(await p.evaluate(() => [...document.querySelectorAll('#mb-dernieres .mb-der .a')].map(e => e.textContent.replace('n°', ''))), attendu, 'mobile : toutes les mises bas (plus de limite à 5), même ordre');
  else eq(await p.evaluate(() => [...document.querySelectorAll('#mb-table-campagne tr td:first-child')].slice(0, 9).map(e => e.textContent)), attendu, 'PC : tableau dans le même ordre');
  // modifier une mise bas (fiche brebis) ne change pas son rang
  await p.evaluate(() => { currentSheepId = 'b3'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b3'); });
  await p.click('#btn-save-agnelage'); await p.clock.runFor(300);
  eq(await p.evaluate(() => misebasCampagneRows().map(r => r.numero)), attendu, nom + ' : une modification garde l\'instant d\'origine');
  console.log('OK ' + nom + ' : mises bas dans l\'ordre d\'enregistrement, liste complète.');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « ORDRE DES MISES BAS » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
