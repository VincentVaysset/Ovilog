/* Liste Agneaux (mobile et PC) : par n°, campagne de naissance (la plus ancienne d'abord, d'après la date de la mise bas) puis n° croissant,
   quel que soit l'ordre des dates de mise bas ou d'enregistrement (trierAgneauxParNumero). Affichage seul. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ATTENDU = ['61040', '71003', '71007', '71012', '71020'];
for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext(bureau ? { viewport: { width: 1400, height: 1000 } } : { viewport: { width: 390, height: 844 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  const ordre = await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
    const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    const l = (n, sexe) => ({ sexe, adopte: false, eid: '2500000456' + n, sanitaire: [], mouvements: [] });
    DB.brebis = [fiche('669001', 'b1'), fiche('669002', 'b2'), fiche('669003', 'b3')]; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.brebis[0].agnelages = [{ date: '2026-11-01', campagne: 2026, lambs: [l('71012', 'Mâle'), l('71003', 'Femelle')] }];
    DB.brebis[1].agnelages = [{ date: '2026-10-25', campagne: 2026, lambs: [l('71020', 'Mâle')] }];
    DB.brebis[2].agnelages = [{ date: '2025-11-02', campagne: 2025, lambs: [l('61040', 'Mâle')] }, { date: '2026-11-01', campagne: 2026, lambs: [l('71007', 'Femelle')] }];
    agneauxMobileTab = 'attente'; render('agneaux');
    return (document.getElementById('app').textContent.match(/[67]10\d\d/g) || []).filter((v, i, t) => t.indexOf(v) === i);
  });
  eq(ordre, ATTENDU, nom + ' : campagne de naissance puis n° croissant (ni le jour de mise bas, ni l\'ordre d\'enregistrement)');
  console.log('OK ' + nom);
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « ORDRE DE LA LISTE AGNEAUX » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
