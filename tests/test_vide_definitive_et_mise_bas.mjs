/* Brebis marquée vide définitive ET mise bas la même campagne : la MISE BAS fait foi partout (videDefinitiveRetenue) — même comptage à
   l'Accueil (mobile et PC), au Bilan de campagne et dans le taux de réussite ; aucune donnée corrigée (la marque reste sur la fiche, l'alerte
   « incohérente » du Bilan reste). saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-12-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const f = (n, opts) => Object.assign({ id: 'b' + n, eid: '2500000456' + (51000 + n), statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2020-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [], agnelages: [] }, opts);
  const mb = d => [{ date: d, campagne: 2027, codeRepro: 'MN', lambs: [{ sexe: 'Mâle' }] }];
  DB.brebis = [
    f(1, { agnelages: mb('2026-11-02') }),                                                                      // mise bas
    f(2, { agnelages: mb('2026-11-03'), videesDefinitives: [{ campagne: 2027, date: '2026-10-20' }] }),          // les deux : mise bas fait foi
    f(3, { videesDefinitives: [{ campagne: 2027, date: '2026-10-20' }] }),                                        // vide définitive
    f(4)];                                                                                                        // à mettre bas
  window.__avant = JSON.stringify(DB.brebis);
});
eq(await p.evaluate(() => DB.brebis.map(s => videDefinitiveRetenue(s))), [false, false, true, false], 'règle commune : la mise bas l\'emporte');
eq(await p.evaluate(() => { const c = campagneBilanChiffres(DB.brebis); return [c.misesBasActives, c.videsDefinitivesActives, c.troupeauAMettreBas, c.misesBasRestantes]; }), [2, 1, 3, 1],
  'Accueil / Bilan / Mises bas : 2 mises bas, 1 vide définitive, 3 attendues, 1 restante');
eq(await p.evaluate(() => { const t = tauxReussiteGlobal(DB.brebis); return [t.misesBas, t.videsDefinitives, t.taux]; }), [2, 1, 66.7], 'taux de réussite : même comptage');
eq(await p.evaluate(() => DB.brebis.slice(0, 3).map(s => statutReproductionCampagne(s))), ['Mise bas', 'Mise bas', 'Vide définitive'], 'statut de la campagne : même règle');
eq(await p.evaluate(() => JSON.stringify(DB.brebis) === window.__avant), true, 'aucune donnée corrigée (la marque reste sur la fiche)');
console.log('OK : vide définitive + mise bas = mise bas, même comptage partout, rien de corrigé.');
await browser.close();
console.log('test_vide_definitive_et_mise_bas : OK');
