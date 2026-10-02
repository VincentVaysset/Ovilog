/* Référence « mobile identique » du Bilan de reproduction : le HTML de l'écran
   mobile (jeu SYNTHÉTIQUE, date de bascule fixe, aucun EID réel) est comparé
   octet pour octet à tests/ref/bilan_mobile.html, prise APRÈS l'étape A (règle
   antenaise). Toute évolution ultérieure (page PC, PDF complet...) qui ne doit
   PAS toucher l'affichage mobile fait échouer ce test si elle le modifie.
   Pour régénérer volontairement la référence : OVILOG_MAJ_REF=1 node test_bilan_mobile_reference.mjs */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'bilan_mobile.html');
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const html = await page.evaluate(() => {
  DB = migrateData({});
  const eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const mb = l => ({ date: '2026-11-20', campagne: 2026, lambs: l.map(s => ({ sexe: s, statutFinal: s === 'Mâle' ? 'mort' : undefined })) });
  const ren = (n, o) => fiche(eid(6, n), Object.assign({ mouvements: [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2026-09-29' }] }, o || {}));
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29';
  DB.brebis = [ren(1, { agnelages: [mb(['Mâle'])] }), ren(2), ren(3, { agnelages: [mb(['Femelle', 'Mâle'])] }),
    fiche(eid(5, 1), { agnelages: [mb(['Mâle', 'Mort-né'])] }), fiche(eid(5, 2)), fiche(eid(3, 1), { agnelages: [mb(['Femelle'])] }), fiche(eid(3, 2)),
    fiche('1234')];
  DB.beliers = []; DB.agnelles = [];
  DB.lots = [{ id: 'lot-ep', type: 'reproduction', mode: 'EP', cible: 'Brebis', nom: 'Lot éponge test', membres: [eid(6, 1), eid(5, 1), eid(3, 1), eid(3, 2)], dateCreation: '2026-07-01', dateEvenement: '2026-07-01' }];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  return bilanReproductionHtml();
});
await browser.close();
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) {
  writeFileSync(REF, html);
  console.log('Référence ' + (existsSync(REF) ? 'écrite' : '') + ' : ' + REF + ' (' + html.length + ' caractères)');
  process.exit(0);
}
const attendu = readFileSync(REF, 'utf8');
if (html !== attendu) {
  const i = [...html].findIndex((c, k) => c !== attendu[k]);
  console.log('FAIL: le HTML mobile du bilan a changé (1re différence au caractère ' + i + ')\n  attendu : …' + attendu.slice(Math.max(0, i - 60), i + 80).replace(/\n/g, ' ') + '\n  obtenu  : …' + html.slice(Math.max(0, i - 60), i + 80).replace(/\n/g, ' '));
  process.exit(1);
}
console.log('OK : HTML mobile du bilan identique à la référence (' + html.length + ' caractères, octet pour octet).');
console.log('  carte de lot présente : ' + html.includes('lot-eponge-card') + ' ; avertissement : ' + html.includes('pas de renouvellement'));
