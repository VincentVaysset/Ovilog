/* Référence « mobile identique » de l'onglet « Mouvements d'animaux » : les 4 onglets (Brebis / Béliers / Agnelles / Agneaux), l'écran de choix de
   catégorie du mouvement collectif, son formulaire (sélecteur clic / bip en série, type choisi) et l'écran « Gérer / annuler un mouvement
   collectif » : HTML comparé octet pour octet à tests/ref/mouvements_mobile.json, pris AVANT la refonte PC (jeu SYNTHÉTIQUE, horloge figée,
   mobile = pas d'electronAPI.isDesktop). Régénérer volontairement : OVILOG_MAJ_REF=1 node test_mouvements_mobile_reference.mjs */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'mouvements_mobile.json');
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  DB = migrateData({}); saveData = function () {};
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Acheteur A']; DB.causesMortalite = ['Mammite'];
  const A = fiche(eid(8, 8133), { id: 'A' });
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [
    { eid: eid(6, 801), sexe: 'Mâle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] },
    { eid: eid(6, 803), sexe: 'Mâle', sanitaire: [], statutFinal: 'vendu', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }, { type: 'Vendu', acheteur: 'Acheteur A', date: '2026-10-02' }] }] }];
  DB.brebis = [A, fiche(eid(9, 59), { id: 'B', statut: 'morte', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Morte', cause: 'Mammite', date: '2026-10-02' }] }),
    fiche(eid(9, 69), { id: 'C', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02', collectifId: 'MC-test1' }] })];
  DB.beliers = [fiche(eid(9, 90), { id: 'bel1', statut: 'actif' }), fiche(eid(9, 92), { id: 'bel3', statut: 'vendu', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02' }] })];
  DB.agnelles = [fiche(eid(5, 41), { id: 'ag1' })];
  DB.registre = { brebis: {}, beliers: {}, agnelles: { [eid(5, 40)]: { eid: eid(5, 40), sanitaire: [], agnelages: [], mouvements: [{ type: 'Entrée', date: '2025-10-01' }, { type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02', collectifId: 'MC-test2' }] } } };
  DB.mouvementsCollectifs = [
    { id: 'MC-test1', categorie: 'brebis', annulable: true, type: 'Vente', cause: null, acheteur: 'Acheteur A', date: '2026-10-02', membres: [eid(9, 69)], createdAt: 1 },
    { id: 'MC-test2', categorie: 'agnelles', annulable: false, type: 'Vente', cause: null, acheteur: 'Acheteur A', date: '2026-10-02', membres: [eid(5, 40)], createdAt: 2 }];
  const app = () => document.getElementById('app').innerHTML;
  const R = {};
  ['brebis', 'beliers', 'agnelles', 'agneaux'].forEach(t => { inventaireTab = t; render('inventaire'); R['onglet_' + t] = app(); });
  render('mouvement-groupe'); R.choix_categorie = app();
  document.querySelector('.cat-mc-opt[data-val="brebis"]').click(); R.formulaire_brebis_clic = app();
  document.querySelector('.type-opt[data-val="Vente"]').click(); R.formulaire_brebis_vente = app();
  render('mouvement-groupe'); document.querySelector('.cat-mc-opt[data-val="agneaux"]').click(); R.formulaire_agneaux = app();
  render('mouvements-collectifs'); R.historique_collectif = app();
  return R;
});
await browser.close();
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) { writeFileSync(REF, JSON.stringify(res)); console.log('Référence écrite : ' + REF + ' (' + Object.entries(res).map(([k, v]) => k + ' ' + v.length).join(', ') + ')'); process.exit(0); }
const attendu = JSON.parse(readFileSync(REF, 'utf8'));
let ko = false;
for (const k of Object.keys(attendu)) if (attendu[k] !== res[k]) { ko = true; const i = [...res[k]].findIndex((c, n) => c !== attendu[k][n]); console.log('FAIL: écran mobile « ' + k + ' » modifié (caractère ' + i + ')\n  attendu : …' + attendu[k].slice(Math.max(0, i - 40), i + 80) + '\n  obtenu  : …' + res[k].slice(Math.max(0, i - 40), i + 80)); }
if (ko) process.exit(1);
console.log('OK : ' + Object.keys(attendu).length + ' écrans mobiles de « Mouvements d\'animaux » identiques à la référence (' + Object.entries(attendu).map(([k, v]) => k + ' ' + v.length).join(', ') + ').');
