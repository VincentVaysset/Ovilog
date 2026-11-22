/* Correction d'un EID (fiche brebis, mobile et PC) : la fenêtre liste TOUS les endroits qui citent cet EID (lots, évènements de lots, mère
   adoptive d'un agneau, registre d'élevage, traitements collectifs…), sous l'une ou l'autre forme (11 / 15 chiffres), et les met à jour en UN
   geste, sans confirm() ; nouvel EID normalisé sur 15 chiffres ; EID déjà porté sous l'autre forme = refusé ; bandeau « EID corrigé · Annuler »
   = toutes les valeurs exactes d'avant. saveData REMPLACÉ ; jeu synthétique (indicatif 000045). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const f = (id, eid) => ({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [f('a', '250 000004551001'), f('b', '250000004551002'), f('c', '250000004551003')];   // a : la brebis à corriger (EID avec espaces, sans historique)
    DB.brebis[1].agnelages = [{ date: '2026-11-02', campagne: 2027, lambs: [{ sexe: 'Mâle', eid: '250000004561001', adopte: true, adoptiveEid: '00004551001' }] }];   // adoptée par a (11 chiffres)
    DB.lots = [{ id: 'L1', nom: 'Lot test', type: 'recherche', membres: ['250000004551001', '250000004551002'], dateCreation: '2026-11-01' }];
    DB.registre = { brebis: { '250 000004551001': { mouvements: [{ type: 'Entrée', date: '2024-01-01' }] } }, beliers: {}, agnelles: {} };
    DB.traitementsCollectifs = [{ id: 'T1', produit: 'Produit A', membres: [{ eid: '250000004551001' }, { eid: '250000004551003' }] }];
    window.__avant = JSON.stringify(DB);
    currentSheepId = 'a'; ficheBrebisTabSheepId = 'a'; ficheBrebisTab = 'ident'; render('detail', 'a');
  });
  await p.click('#btn-corriger-eid');
  // EID déjà porté sous l'autre forme : refusé
  await p.fill('#ce-eid', '00004551003');
  check(/appartient déjà/.test(await p.textContent('#ce-err')), nom + ' : EID d\'une autre brebis sous l\'autre forme refusé');
  // nouvel EID (n° national 11 chiffres) : normalisé, liens listés
  await p.fill('#ce-eid', '00004551009');
  const liste = (await p.textContent('#ce-liens-liste')).replace(/\s+/g, ' ');
  ['Lots : 1', "Fiches d'autres brebis (mère, mère adoptive, père…) : 1", "Registre d'élevage : 1", 'Traitements collectifs : 1'].forEach(t => check(liste.includes(t), nom + ' : « ' + t + ' » listé : ' + liste));
  await p.click('#ce-save');
  eq(await p.evaluate(() => [DB.brebis[0].eid, DB.lots[0].membres, DB.brebis[1].agnelages[0].lambs[0].adoptiveEid, Object.keys(DB.registre.brebis), DB.traitementsCollectifs[0].membres.map(m => m.eid)]),
    ['250000004551009', ['250000004551009', '250000004551002'], '250000004551009', ['250000004551009'], ['250000004551009', '250000004551003']], nom + ' : EID normalisé sur 15 chiffres, tous les liens mis à jour ensemble');
  check(!(await p.$('.sheet-overlay')), nom + ' : fenêtre fermée');
  check(/EID corrigé/.test(await p.textContent('.ce-snack')), nom + ' : bandeau « EID corrigé · Annuler »');
  await p.click('#ce-snack-annuler');
  eq(await p.evaluate(() => JSON.stringify(DB) === window.__avant), true, nom + ' : « Annuler » = base exacte d\'avant (EID avec espaces, 11 chiffres de la mère adoptive, clé du registre)');
  console.log('OK ' + nom + ' : liens listés, mis à jour ensemble, conflit sous l\'autre forme refusé, Annuler exact.');
  await p.context().close();
}
await browser.close();
console.log('test_correction_eid_liens : OK');
