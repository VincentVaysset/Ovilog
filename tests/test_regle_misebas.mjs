/* Règle mises bas : attendues = brebis PRÉSENTES − vides définitives PRÉSENTES ; restantes = attendues − brebis ayant mis bas ; une brebis à la fois vide définitive et ayant mis bas compte comme vide définitive
   UNIQUEMENT ; une vide définitive sortie (vendue) n'est pas retirée une seconde fois. Même fonction pour l'Accueil mobile, l'Accueil PC et la Saisie de mises bas. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (n) => '25000001297' + String(n).padStart(4, '0');
  let k = 0;
  const fiche = (id, o) => Object.assign({ id, eid: eid(++k), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const mb = (date, n) => [{ date, campagne: 2026, lambs: Array.from({ length: n }, (_, i) => ({ eid: eid(900 + k * 10 + i), sexe: i % 2 ? 'Femelle' : 'Mâle', sanitaire: [], mouvements: [] })) }];
  const vd = () => ({ videesDefinitives: [{ campagne: 2026, date: '2026-09-01' }] });
  const vendue = () => ({ statut: 'vendue', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', date: '2026-09-10' }] });
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [
    fiche('A1', { agnelages: mb('2026-11-02', 1) }), fiche('A2', { agnelages: mb('2026-11-03', 2) }), fiche('A3', { agnelages: mb('2026-11-04', 1) }),   // 3 ont mis bas
    fiche('A4'), fiche('A5'), fiche('A6'), fiche('A7'),                                                                                                       // 4 attendues pas encore mises bas
    fiche('V1', vd()), fiche('V2', vd()),                                                                                                                     // 2 vides définitives présentes
    fiche('V3', Object.assign({ agnelages: mb('2026-11-05', 1) }, vd())),                                                                                     // vide définitive qui a mis bas : vide définitive seulement
    fiche('S1', Object.assign(vd(), vendue())),                                                                                                               // vide définitive vendue : pas dans les présentes, pas retirée
    fiche('S2', Object.assign({ agnelages: mb('2026-11-06', 1) }, vendue()))];                                                                                // vendue après mise bas : pas dans les présentes
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-12-01T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu);
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
// présentes : A1..A7 (7) + V1, V2, V3 (3) = 10 ; vides définitives présentes : V1, V2, V3 = 3 ; attendues = 7 ; ont mis bas (hors vides définitives) : A1, A2, A3 = 3 ; restantes = 4
const C = await pc.evaluate(() => campagneBilanChiffres(DB.brebis.filter(s => (s.statut || 'active') === 'active')));
eq([C.troupeauAMettreBas, C.videsDefinitivesActives, C.misesBasActives, C.misesBasRestantes], [7, 3, 3, 4], 'attendues = 10 présentes − 3 vides définitives présentes ; fait = 3 (V3 compte comme vide définitive seulement) ; restantes = 4 ; S1 (vide définitive vendue) et S2 (vendue) ne comptent pas');
console.log('OK 1 fonction commune : attendues, fait et restantes.');
// Accueil mobile
await mob.evaluate(() => render('home'));
const m = await mob.evaluate(() => ({ gros: document.querySelector('.ac-big').textContent.trim(), sur: document.querySelector('.ac-sur').textContent.trim(), rest: [...document.querySelectorAll('.ac-stats div, .ac-3 div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()).find(t => /Restantes/.test(t)) }));
eq([m.gros, m.sur], ['3', 'sur 7 brebis'], 'Accueil mobile : 3 sur 7 attendues');
check(/4\s*Restantes/.test(m.rest || ''), 'Accueil mobile : 4 restantes : ' + JSON.stringify(m));
console.log('OK 2 Accueil mobile.');
// Saisie de mises bas (PC)
await pc.evaluate(() => render('misebas-rapide'));
const k = await pc.evaluate(() => Object.fromEntries([...document.querySelectorAll('.brd-kpi')].map(e => [e.querySelector('.brd-kpi-l').textContent.trim(), [e.querySelector('.brd-kpi-v').textContent.trim(), (e.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));
check(k['Restantes'] && k['Restantes'][0] === '4' && /42,9 % réalisé/.test(k['Restantes'][1]) && /sur 7 attendues/.test(k['Mises bas'][1]), 'Saisie de mises bas : 4 restantes, 3 mises bas sur 7 attendues (42,9 % réalisé) : ' + JSON.stringify(k));
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture');
console.log('OK 3 Saisie de mises bas.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA RÈGLE « MISES BAS ATTENDUES / RESTANTES » SONT PASSÉS.');
