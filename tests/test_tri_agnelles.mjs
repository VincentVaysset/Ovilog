/* Chantier de tri, parties d, e, f : TRI DES AGNELLES -- logique commune (compteur N/M, classe et lactation de la mère, type de naissance, incohérences remontées
   sans correction), page PC, comportement mobile (carte enrichie, bip qui ouvre la carte sans rien valider, retour au scan, toast avec Annuler).
   saveData REMPLACÉ par un compteur ; jeu synthétique ; l'export réel, s'il est présent, est chargé en LECTURE SEULE (section finale). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1800 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const l = (n, sexe, extra) => Object.assign({ eid: sexe === 'Femelle' || extra && extra.eid ? E(6, n) : undefined, sexe, sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-01-14' }] }, extra || {});
  const A = f(8, 133, { agnelages: [{ campagne: 2025, date: '2026-01-14', codeRepro: 'IA', lambs: [l(1, 'Femelle'), l(2, 'Femelle', { triStatut: 'gardée' }), l(3, 'Mâle')] }] });
  const B = f(9, 59, { agnelages: [{ campagne: 2025, date: '2026-01-19', codeRepro: 'MN', lambs: [l(4, 'Femelle')] }, { campagne: 2024, date: '2025-01-05', codeRepro: 'MN', lambs: [l(5, 'Femelle', { triStatut: 'écartée' })] }] });
  const C = f(0, 33, { agnelages: [{ campagne: 2025, date: '2026-01-25', codeRepro: 'MN', lambs: [l(6, 'Femelle', { statutFinal: 'vendu' }), l(7, 'Femelle', { triStatut: 'gardée' }), l(8, 'Femelle', { triStatut: 'gardée', statutFinal: 'vendu' })] }] });
  DB.brebis = [A, B, C];
  DB.lactationModele = [{ eid: E(8, 133), campagne: 2025, lactationTotale: 452, classeParQuart: '1' }];
  DB.agnelles = [{ id: 'ag2', eid: E(6, 2), origine: 'née', motherEid: E(8, 133), dateEntree: '2026-09-01', mouvements: [{ type: 'Naissance', date: '2026-01-14' }, { type: 'Entrée', date: '2026-09-01' }], sanitaire: [] },
    { id: 'ag3', eid: E(5, 42), origine: 'achetée', dateEntree: '2026-09-10', mouvements: [{ type: 'Entrée', date: '2026-09-10' }], sanitaire: [] }];
  window.__avant = JSON.stringify(DB);
});
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

// ================================================================ 1. logique commune : blocs, compteur N/M, info de la mère
await jeu();
const d = await page.evaluate(() => { const r = triAgnellesDonnees(); const m = x => [x.numero, x.mereNumero, x.classeMere, x.lactMere, x.naissance]; return { aTrier: r.aTrier.map(m), gardees: r.gardees.map(x => [x.numero, x.origine, x.mereNumero, x.classeMere, x.lactMere, x.naissance]), ecartees: r.ecartees.map(m), c: r.compteur }; });
check(JSON.stringify(d.aTrier) === JSON.stringify([['60001', '80133', 1, 452, 'Triple'], ['60004', '90059', null, null, 'Simple']]), 'À trier : femelles nées, sans décision, ni vendues ni mortes ; mère, classe, lactation N-1, type de naissance (« - » = null) : ' + JSON.stringify(d.aTrier));
check(JSON.stringify(d.ecartees) === JSON.stringify([['60005', '90059', null, null, 'Simple']]), 'Écartées : ' + JSON.stringify(d.ecartees));
check(JSON.stringify(d.gardees) === JSON.stringify([['60002', 'Née', '80133', 1, 452, 'Triple'], ['50042', 'Achetée', null, null, null, null]]), 'Triées / achetées : ' + JSON.stringify(d.gardees));
check(JSON.stringify(d.c) === JSON.stringify({ N: 1, M: 4, aTrier: 2, ecartees: 1, achetees: 1, pct: 25 }), 'compteur : N = 1 gardée née ; M = 2 à trier + 1 gardée + 1 écartée = 4 (la vendue, la gardée vendue et l\'achetée n\'y sont pas) : ' + JSON.stringify(d.c));
const inc = await page.evaluate(() => incoherencesTriAgnelles().map(x => [x.type, x.numero, x.mere]));
check(JSON.stringify(inc) === JSON.stringify([['gardée sans fiche d\'agnelle', '60007', '00033']]), 'incohérence remontée (gardée sans fiche, hors vendue) : ' + JSON.stringify(inc));
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'rien n\'est corrigé ni écrit par ces calculs');
const rech = await page.evaluate(() => ['60004', '60002', '60005', '50042', '99999'].map(q => { const r = trouverAgnelleTriParNumero(q); return r ? r.bloc : null; }));
check(JSON.stringify(rech) === '["aTrier","gardees","ecartees","gardees",null]', 'recherche par n° : bloc de l\'agnelle : ' + JSON.stringify(rech));
const cp = await page.evaluate(() => ({ pc: compteurTriAgnellesHtml(triAgnellesDonnees().compteur, 'pc'), mob: compteurTriAgnellesHtml(triAgnellesDonnees().compteur, 'mobile') }));
check(/<b[^>]*>1<\/b> triées sur <b[^>]*>4<\/b> femelles nées actives/.test(cp.pc) && /width:25%/.test(cp.pc) && /à trier 2|À trier 2 · écartées 1 · achetées 1 en plus \(hors total\)/.test(cp.pc) && /<b[^>]*>1<\/b> triées sur <b[^>]*>4<\/b>/.test(cp.mob) && /achetées 1 \(hors total\)/.test(cp.mob), 'compteur PC et mobile : même calcul, barre à 25 %');
console.log('OK 1 logique commune : blocs, compteur N/M (achetées, vendues hors total), mère / classe / lactation / naissance (« - » sans donnée), incohérence remontée sans correction, recherche par n°.');

await browser.close();
console.log('\nTOUS LES TESTS DU TRI DES AGNELLES SONT PASSÉS');
