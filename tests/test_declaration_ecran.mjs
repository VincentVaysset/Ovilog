/* Refonte Calendrier / Déclaration annuelle, partie C0 : écran Déclaration annuelle. PC : en-tête « Déclaration <année> » avec choix de l'année et « Exporter (PDF) » vert en haut à droite ;
   « Recensement au 1er janvier » : 4 tuiles sur une ligne ; « Ratio PAC (aide ovine) · année-1 » : 3 chiffres + ratio en vert avec sa formule (plus de ❔), 2 décimales à la française ;
   « Non disponible » conservé ; « Données insuffisantes » conservé. Mobile : mêmes cartes, tuiles sur 2 colonnes, bouton d'export vert en bas. Mêmes chiffres que
   declarationAnnuelleChiffres. Le PDF généré est vérifié dans test_declaration_pdf. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const box = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);

for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 420, height: 1400 } })).newPage();
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  const jeu = (premiereEntree) => page.evaluate((pe) => {
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    const b = (n, entree, agn) => ({ id: 'b' + n, eid: '250 0162991000' + n, statut: 'active', dateEntree: entree, mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: agn || [], createdAt: 1 });
    const lamb = (vendu) => ({ eid: 'l' + Math.random(), sexe: 'Mâle', mouvements: vendu ? [{ type: 'Vendu', date: '2025-05-10', acheteur: 'X' }] : [] });
    DB.brebis = [b(1, pe, [{ date: '2025-02-01', lambs: [lamb(true), lamb(true), lamb(false)] }]), b(2, pe, [{ date: '2025-03-01', lambs: [lamb(true), lamb(false)] }]), b(3, pe), b(4, pe)];
    DB.beliers = [{ id: 'be1', eid: '250 0162991000b1', statut: 'actif', dateEntree: pe, mouvements: [] }]; DB.agnelles = [];
    declarationAnneeSelectionnee = 2026; render('declaration-annuelle');
  }, premiereEntree);
  await jeu('2024-06-01');
  const c = await page.evaluate(() => declarationAnnuelleChiffres(2026));
  // ---- en-tête et export
  eq(await page.evaluate(() => document.querySelector('.brd-title').textContent), 'Déclaration 2026', nom + ' : titre');
  check(await page.evaluate(() => document.getElementById('app').textContent.includes('Recensement au 1er janvier et ratio de l\'aide ovine')), nom + ' : sous-titre');
  check(!(await page.evaluate(() => document.getElementById('app').textContent.includes('❔'))), nom + ' : aucun ❔');
  eq(await page.evaluate(() => document.getElementById('btn-export-declaration-pdf').textContent + '|' + document.getElementById('btn-export-declaration-pdf').classList.contains('btn-primary')), 'Exporter (PDF)|true', nom + ' : bouton vert « Exporter (PDF) »');
  const bExp = await box(page, '#btn-export-declaration-pdf'), bRec = await box(page, '#decl-recensement'), bSel = await box(page, '#declaration-annee');
  if (bureau) check(bExp.y < bRec.y && bExp.x > 900 && Math.abs((bExp.y + bExp.h / 2) - (bSel.y + bSel.h / 2)) < 8, 'PC : année et export en haut à droite, sur la même ligne');
  else check(bExp.y > (await box(page, '#decl-ratio')).y, 'mobile : bouton d\'export sous les cartes');
  // ---- recensement : 4 tuiles, mêmes chiffres
  const tuiles = (carte) => page.evaluate(s => [...document.querySelectorAll(s + ' .decl-tuile')].map(t => [t.querySelector('.decl-tuile-l').textContent, t.querySelector('.decl-tuile-v').textContent, t.getBoundingClientRect().x | 0, t.getBoundingClientRect().y | 0]), carte);
  const tr = await tuiles('#decl-recensement');
  eq(tr.map(t => [t[0], t[1]]), [['Brebis présentes', String(c.recensement.brebis)], ['Béliers présents', String(c.recensement.beliers)], ['Agnelles >6 mois présentes', String(c.recensement.agnelles)], ['Agneaux nés en 2025', String(c.recensement.agneauxNes)]], nom + ' : 4 tuiles de recensement = declarationAnnuelleChiffres');
  if (bureau) check(new Set(tr.map(t => t[3])).size === 1, 'PC : les 4 tuiles du recensement sont sur une ligne');
  else check(new Set(tr.map(t => t[2])).size === 2 && new Set(tr.map(t => t[3])).size === 2, 'mobile : tuiles sur 2 colonnes');
  eq(await page.evaluate(() => document.querySelector('#decl-recensement .prm-titre').textContent), 'Recensement au 1er janvier 2026', nom + ' : titre de carte');
  // ---- ratio
  eq(await page.evaluate(() => document.querySelector('#decl-ratio .prm-titre').textContent), 'Ratio PAC (aide ovine) · 2025', nom + ' : titre de la carte ratio');
  const rt = await tuiles('#decl-ratio');
  eq(rt.slice(0, 3).map(t => [t[0], t[1]]), [['Brebis présentes au 1er janvier 2025', String(c.brebisRatio)], ['Agneaux nés en 2025', String(c.agneauxNesRatio)], ['Agneaux vendus en 2025', String(c.agneauxVendusRatio)]], nom + ' : 3 chiffres du ratio');
  const attendu = c.ratio.toFixed(2).replace('.', ',');
  eq(rt[3].slice(0, 2), ['Ratio', attendu], nom + ' : ratio à 2 décimales, virgule');
  check(c.ratio !== null && /^\d+,\d\d$/.test(attendu), nom + ' : format 1,17');
  check(await page.evaluate(() => { const t = document.querySelector('.decl-tuile-ratio'); return !!t && /agneaux vendus ÷ brebis présentes/.test(t.textContent) && /≈ 0,5/.test(t.textContent) && getComputedStyle(t).backgroundColor !== getComputedStyle(document.querySelector('.decl-tuile:not(.decl-tuile-ratio)')).backgroundColor; }), nom + ' : ratio en vert avec sa formule et le seuil indicatif');
  if (bureau) check(new Set(rt.map(t => t[3])).size === 1, 'PC : les 4 tuiles du ratio sont sur une ligne');
  console.log('OK ' + nom + ' : en-tête, export, recensement, ratio 2 décimales en vert avec formule, aucun ❔.');
  // ---- changement d'année
  await page.selectOption('#declaration-annee', '2025');
  eq(await page.evaluate(() => document.querySelector('.brd-title').textContent), 'Déclaration 2025', nom + ' : changement d\'année');
  // ---- non disponible (aucune brebis au 1er janvier de l'année précédente)
  await jeu('2025-06-01');
  const rt2 = await tuiles('#decl-ratio');
  eq(rt2[3].slice(0, 2), ['Ratio', 'Non disponible'], nom + ' : « Non disponible » conservé');
  check(await page.evaluate(() => !!document.querySelector('.decl-tuile-nd') && !document.querySelector('.decl-tuile-ratio')), nom + ' : tuile grise, pas verte');
  // ---- données insuffisantes
  await jeu('2026-01-01'); await page.evaluate(() => { declarationAnneeSelectionnee = 2026; render('declaration-annuelle'); });
  check(await page.evaluate(() => /Données insuffisantes \(aucune donnée dans l'appli avant 2026\)/.test(document.getElementById('decl-ratio').textContent) && !document.querySelector('#decl-ratio .decl-tuile')), nom + ' : « Données insuffisantes » conservé');
  console.log('OK ' + nom + ' : année, « Non disponible », « Données insuffisantes ».');
  await page.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ÉCRAN DÉCLARATION ANNUELLE SONT PASSÉS');
