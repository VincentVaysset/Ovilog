/* Référence « mobile identique » des écrans touchés par les alertes du carnet sanitaire : mouvement individuel (brebis) avec
   type Vente et date choisis, mouvement collectif (formulaire), fenêtre de vente d'un agneau, fenêtre « Vendre » d'une agnelle,
   écrans d'import du contrôle laitier (modèle Ovilog et SIEOL avant fichier) : HTML comparé octet pour octet à
   tests/ref/alertes_mobile.json, pris AVANT les alertes (jeu SYNTHÉTIQUE, horloge figée, mobile = pas d'electronAPI.isDesktop).
   Régénérer volontairement : OVILOG_MAJ_REF=1 node test_alertes_mobile_reference.mjs */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'alertes_mobile.json');
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  DB = migrateData({}); saveData = function () {};
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Acheteur test'];
  const soin = { type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, intervenant: 'Éleveur', commentaire: '', dureeJours: 1, delaiLaitJours: 7, delaiViandeJours: 28 };
  DB.brebis = [fiche(eid(3, 1), { id: 'A', sanitaire: [soin] }), fiche(eid(3, 2), { id: 'B' })];
  DB.brebis[1].agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 801), sexe: 'Mâle', statut: 'vivant', sanitaire: [{ type: 'Traitement', produit: 'Séléphérol', dose: '2 cc', date: '2026-09-25', commentaire: '' }], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] }] }];
  DB.beliers = []; DB.agnelles = [fiche(eid(6, 70), { id: 'AG', sanitaire: [soin] })]; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const app = () => document.getElementById('app').innerHTML;
  const R = {};
  currentSheepId = 'A'; editContext = null; render('add-mouvement');
  document.querySelector('.type-opt[data-val="Vente"]').click();
  document.getElementById('f-date').value = '2026-10-10'; document.getElementById('f-date').dispatchEvent(new Event('input')); document.getElementById('f-date').dispatchEvent(new Event('change'));
  R.mouvement_individuel = app();
  window.__mouvementGroupeSelected = { brebis: new Set(['A']), beliers: new Set(), agnelles: new Set(), agneaux: new Set() };
  render('mouvement-groupe'); document.querySelector('.cat-mc-opt[data-val="brebis"]').click();
  document.querySelector('.type-opt[data-val="Vente"]').click();
  document.getElementById('f-date').value = '2026-10-10'; document.getElementById('f-date').dispatchEvent(new Event('input'));
  R.mouvement_collectif = app();
  showLambSortieModal(DB.brebis[1].agnelages[0].lambs[0], 'vendu', () => {}); R.modale_agneau = document.querySelector('.modal-overlay').outerHTML; document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  showVendreAgnelleModal(DB.agnelles[0], () => {}); R.modale_agnelle = document.querySelector('.modal-overlay').outerHTML; document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  render('import-controle-laitier-modele'); R.import_modele = app();
  render('import-controle-laitier-sieol'); R.import_sieol = app();
  return R;
});
await browser.close();
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) { writeFileSync(REF, JSON.stringify(res)); console.log('Référence écrite : ' + REF + ' (' + Object.entries(res).map(([k, v]) => k + ' ' + v.length).join(', ') + ')'); process.exit(0); }
const attendu = JSON.parse(readFileSync(REF, 'utf8'));
let ko = false;
for (const k of Object.keys(attendu)) if (attendu[k] !== res[k]) { ko = true; const i = [...res[k]].findIndex((c, n) => c !== attendu[k][n]); console.log('FAIL: écran mobile « ' + k + ' » modifié (caractère ' + i + ')\n  attendu : …' + attendu[k].slice(Math.max(0, i - 40), i + 80) + '\n  obtenu  : …' + res[k].slice(Math.max(0, i - 40), i + 80)); }
if (ko) process.exit(1);
console.log('OK : ' + Object.keys(attendu).length + ' écrans mobiles touchés par les alertes identiques à la référence (' + Object.entries(attendu).map(([k, v]) => k + ' ' + v.length).join(', ') + ').');
