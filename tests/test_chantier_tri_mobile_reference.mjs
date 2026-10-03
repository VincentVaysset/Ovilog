/* Référence « mobile identique » du Chantier de tri : écran des lots (lots de recherche et de réforme), Nouveau lot, Nouveau lot de réforme, Modifier un lot de
   recherche, Chercher en bergerie, Créer une liste, Tri des agnelles (champ de scan et sections « Agnelles triées / achetées » et « Écartées », hors zone « À trier »
   enrichie par ce chantier) et Ajouter une agnelle : HTML comparé octet pour octet à tests/ref/chantier_tri_mobile.json, pris AVANT le chantier de tri (code du commit
   f1f61de ; jeu SYNTHÉTIQUE, horloge figée, mobile = pas d'electronAPI.isDesktop). Exceptions voulues, absentes de cette référence : bouton « Nouveau lot de
   reproduction » et carte d'un lot de reproduction (détail), carte « À trier » + compteur + comportement au bip.
   Régénérer volontairement : OVILOG_MAJ_REF=1 node test_chantier_tri_mobile_reference.mjs (sur le code d'origine, jamais sur le code modifié). */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'chantier_tri_mobile.json');
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const sansBoutonRepro = h => h.replace(/\s*<button class="btn btn-secondary" id="btn-new-lot-repro"[^>]*>[^<]*<\/button>/, '');       // exception voulue : création d'un lot de reproduction sur PC seulement
const res = await page.evaluate(() => {
  DB = migrateData({}); saveData = function () {};
  const eid = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const fiche = (d, n, o) => Object.assign({ id: 'f' + d + n, eid: eid(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Acheteur A'];
  const A = fiche(8, 133, { agnelages: [{ campagne: 2025, date: '2026-01-14', codeRepro: 'IA', lambs: [
    { eid: eid(6, 1), sexe: 'Femelle', sanitaire: [], mouvements: [] }, { eid: eid(6, 2), sexe: 'Femelle', triStatut: 'gardée', sanitaire: [], mouvements: [] }, { eid: eid(6, 5), sexe: 'Femelle', triStatut: 'écartée', sanitaire: [], mouvements: [] }] }] });
  DB.brebis = [A, fiche(9, 59), fiche(9, 69), fiche(0, 33)];
  DB.agnelles = [{ id: 'ag2', eid: eid(6, 2), origine: 'née', motherEid: eid(8, 133), dateEntree: '2026-09-01', mouvements: [{ type: 'Naissance', date: '2026-01-14' }, { type: 'Entrée', date: '2026-09-01' }], sanitaire: [] },
    { id: 'ag3', eid: eid(5, 42), origine: 'achetée', dateEntree: '2026-09-10', mouvements: [{ type: 'Entrée', date: '2026-09-10' }], sanitaire: [] }];
  DB.lots = [{ id: '1700000000001', nom: 'Brebis doubles', dateCreation: '2026-10-01', membres: [eid(9, 59), eid(9, 69)] }, { id: '1700000000002', nom: 'Réforme du 28-09-2026', type: 'reforme', dateCreation: '2026-09-28', membres: [eid(0, 33)] }];
  const app = () => document.getElementById('app').innerHTML;
  const R = {};
  render('lots'); R.lots = app();
  render('add-lot'); R.add_lot = app();
  render('add-lot-reforme'); R.add_lot_reforme = app();
  currentLotId = '1700000000001'; render('edit-lot'); R.edit_lot_recherche = app();
  currentLotId = '1700000000001'; render('lot-search'); R.lot_search = app();
  render('liste-serie'); R.liste_serie = app();
  render('agnelles'); const h = app(); R.agnelles_sections = h.slice(h.indexOf('Agnelles triées / achetées') - 80);
  R.agnelles_tabbar = h.slice(0, h.indexOf('</div>') + 6);
  editingAgnelleId = null; addAgnelleOrigin = 'agnelles'; render('add-agnelle'); R.add_agnelle = app();
  return R;
});
await browser.close();
res.lots = sansBoutonRepro(res.lots);
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) { writeFileSync(REF, JSON.stringify(res)); console.log('Référence écrite : ' + REF + ' (' + Object.entries(res).map(([k, v]) => k + ' ' + v.length).join(', ') + ')'); process.exit(0); }
const attendu = JSON.parse(readFileSync(REF, 'utf8'));
attendu.lots = sansBoutonRepro(attendu.lots);
let ko = false;
for (const k of Object.keys(attendu)) if (attendu[k] !== res[k]) { ko = true; const i = [...res[k]].findIndex((c, n) => c !== attendu[k][n]); console.log('FAIL: écran mobile « ' + k + ' » modifié (caractère ' + i + ') :\n  attendu …' + attendu[k].slice(Math.max(0, i - 60), i + 80).replace(/\s+/g, ' ') + '\n  obtenu  …' + res[k].slice(Math.max(0, i - 60), i + 80).replace(/\s+/g, ' ')); }
if (ko) process.exit(1);
console.log('OK : ' + Object.keys(attendu).length + ' écrans mobiles du Chantier de tri identiques à la référence (' + Object.entries(attendu).map(([k, v]) => k + ' ' + v.length).join(', ') + ').');
