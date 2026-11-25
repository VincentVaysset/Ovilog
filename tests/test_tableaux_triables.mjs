/* Tableaux triables (règle générale) : UN composant (tableauTriable) pour tous les tableaux. Clic = croissant, re-clic = décroissant, flèche ▲ / ▼
   sur la colonne active et pâle sur les autres, aria-sort ; dates chronologiques, nombres (« 412 L », « 1,5 », « 800 000 »), texte alphabétique,
   « — » et vide en bas ; le tri tient après un redessin ; « Trier par » sur les listes en cartes du mobile. Jeu fictif. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const erreurs = [];

// ---- 1. composant, tableau HTML complet
{
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  page.on('pageerror', e => erreurs.push(e.message));
  await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    const t = document.createElement('div');
    t.innerHTML = `<table class="pc-t" data-triable="essai"><tr><th>N°</th><th>Date</th><th>Lait</th><th data-tri-non>Actions</th></tr>
      <tr><td>601</td><td>12-11-2026</td><td>412 L</td><td>x</td></tr>
      <tr><td>n°61004</td><td>—</td><td>1 250,5 L</td><td>x</td></tr>
      <tr><td>99</td><td>02-01-2027</td><td>—</td><td>x</td></tr>
      <tr data-fixe><td colspan="4">Total</td></tr></table>`;
    document.getElementById('app').appendChild(t);
  });
  await page.waitForTimeout(100);
  const col = j => page.evaluate(j => [...document.querySelectorAll('table[data-triable="essai"] tr')].slice(1).map(r => r.cells[j] ? r.cells[j].textContent : ''), j);
  eq(await page.evaluate(() => [...document.querySelectorAll('table[data-triable="essai"] th')].map(th => [th.textContent, th.getAttribute('aria-sort'), !!th.querySelector('.tt-tete')])),
    [['N°', 'none', true], ['Date', 'none', true], ['Lait', 'none', true], ['Actions', null, false]], 'en-têtes triables (libellé inchangé), colonne d\'actions exclue');
  await page.click('table[data-triable="essai"] th:nth-child(2) .tt-tete');
  eq(await col(1), ['12-11-2026', '02-01-2027', '—', ''], 'dates : ordre chronologique, « — » en bas, ligne de total fixe');
  eq(await page.evaluate(() => [document.querySelector('table[data-triable="essai"] th:nth-child(2)').getAttribute('aria-sort'), getComputedStyle(document.querySelector('table[data-triable="essai"] th:nth-child(2) .tt-fleche'), '::after').content, getComputedStyle(document.querySelector('table[data-triable="essai"] th:nth-child(2) .tt-fleche')).opacity, getComputedStyle(document.querySelector('table[data-triable="essai"] th:nth-child(1) .tt-fleche')).opacity]),
    ['ascending', '"▲"', '1', '0.35'], 'aria-sort, ▲ sur la colonne active, flèche pâle sur les autres');
  await page.click('table[data-triable="essai"] th:nth-child(2) .tt-tete');
  eq([await col(1), await page.evaluate(() => getComputedStyle(document.querySelector('table[data-triable="essai"] th:nth-child(2) .tt-fleche'), '::after').content)], [['02-01-2027', '12-11-2026', '—', ''], '"▼"'], 're-clic : décroissant, « — » toujours en bas, ▼');
  await page.click('table[data-triable="essai"] th:nth-child(3) .tt-tete');
  eq(await col(2), ['412 L', '1 250,5 L', '—', ''], 'nombres avec unité et espaces');
  await page.click('table[data-triable="essai"] th:nth-child(1) .tt-tete');
  eq(await col(0), ['99', '601', 'n°61004', 'Total'], 'n° : nombres avant « n°… »');
  // le tri tient après un redessin (même clé)
  await page.evaluate(() => { const t = document.querySelector('table[data-triable="essai"]'); t.innerHTML = `<tr><th>N°</th><th>Date</th><th>Lait</th><th data-tri-non>Actions</th></tr><tr><td>601</td><td></td><td></td><td></td></tr><tr><td>12</td><td></td><td></td><td></td></tr>`; });
  await page.waitForTimeout(100);
  eq(await col(0), ['12', '601'], 'tableau redessiné : même tri reposé');

  // ---- 2. liste paginée triée avant affichage (Mouvements passés PC)
  await page.evaluate(() => {
    DB = migrateData({}); saveData = function () { return true; }; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    const b = (id, eid, court, mv) => ({ id, eid, numeroCourtTravailSieol: court, statut: 'vendue', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements: [mv] });
    DB.brebis = [b('a', '250000004561001', '603', { type: 'Vente', acheteur: 'Acheteur C', date: '2026-10-05' }), b('b', '250000004561002', '601', { type: 'Morte', cause: 'Mammite', date: '2026-11-01' }), b('c', '250000004561003', '602', { type: 'Vente', acheteur: 'Coop Exemple', date: '2026-10-20' })];
    DB.beliers = []; DB.agnelles = []; render('inventaire');
  });
  const nums = () => page.evaluate(() => [...document.querySelectorAll('#mvp-table tr')].slice(1).map(r => r.cells[1].textContent.trim()));
  await page.click('#mvp-table .tt-tete[data-col="num"]');
  eq(await nums(), ['601', '602', '603'], 'mouvements passés : tri par n°');
  await page.click('#mvp-table .tt-tete[data-col="date"]');
  eq(await nums(), ['603', '602', '601'], 'mouvements passés : tri par date');
  await page.click('#mvp-table .tt-tete[data-col="date"]');
  eq([await nums(), await page.evaluate(() => document.querySelector('#mvp-table th[aria-sort="descending"]') !== null)], [['601', '602', '603'], true], 'décroissant, aria-sort');
}
// ---- 3. mobile : « Trier par » sur les cartes (Mouvements)
{
  const page = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = function () { return true; }; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    const b = (id, eid, court, mv) => ({ id, eid, numeroCourtTravailSieol: court, statut: 'vendue', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements: [mv] });
    DB.brebis = [b('a', '250000004561001', '603', { type: 'Vente', acheteur: 'Acheteur C', date: '2026-10-05' }), b('b', '250000004561002', '601', { type: 'Vente', acheteur: 'Acheteur C', date: '2026-11-01' })];
    DB.beliers = []; DB.agnelles = []; render('inventaire');
  });
  check(await page.isVisible('.tt-trier-par[data-tt="mouvements-mobile"]'), 'mobile : « Trier par » au-dessus des cartes');
  eq(await page.evaluate(() => [...document.querySelectorAll('.tt-trier-par select option')].map(o => o.textContent)), ["Comme à l'écran", 'Date', 'N°', 'Type', 'Cause / acheteur'], 'mobile : mêmes colonnes que le tableau PC');
  await page.selectOption('.tt-trier-par select', 'num');
  eq(await page.evaluate(() => [...document.querySelectorAll('.mm-carte .mm-nm')].map(e => e.textContent)), ['601', '603'], 'mobile : tri par n°');
  await page.click('.tt-trier-par .tt-sens');
  eq(await page.evaluate(() => [[...document.querySelectorAll('.mm-carte .mm-nm')].map(e => e.textContent), document.querySelector('.tt-sens').textContent]), [['603', '601'], '▼ décroissant'], 'mobile : sens inversé');
}
check(!erreurs.length, 'aucune erreur JS ' + erreurs.join(' | '));
await browser.close();
console.log('test_tableaux_triables : OK');
