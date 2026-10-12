/* Contrôle laitier : les imports ne sont plus sur l'écran Contrôle laitier (PC et mobile : plus de bouton « Importer un contrôle (SIEOL) » ni « Importer un cahier de contrôle ») ; la ligne
   « Import des résultats : Paramètres › Imports » figure sous le titre ; la carte « Contrôle laitier · fichiers SIEOL » de Paramètres › Imports (PC) ouvre l'écran d'import SIEOL INTACT :
   choix de la campagne, contrôles C1/C2/C3, fichier résumé ET fichier cahier de contrôle ; le retour (flèche) et la fin de l'import ramènent à Paramètres › Imports ; le dernier import est mémorisé ;
   les données importées (résumé, contrôles) sont écrites comme avant. saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuControleLaitier } from './lib/jeu_registre_cl.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 400, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-01-25T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { page.__alertes = (page.__alertes || []).concat(d.message()); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeuControleLaitier, true);
  await page.evaluate(() => { window.__saves = 0; saveData = function () { window.__saves++; return true; }; localStorage.removeItem('ovilog_derniers_imports'); });
  return page;
}

// ================================================================ 1. écran Contrôle laitier : plus d'import, ligne d'information
for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const page = await ouvrir(bureau);
  await page.evaluate(() => render('controle-laitier'));
  check(await page.evaluate(() => !document.getElementById('btn-cl-import-sieol')), nom + ' : plus de bouton d\'import SIEOL');
  check(await page.evaluate(() => ![...document.querySelectorAll('#app button')].some(b => /Importer/.test(b.textContent))), nom + ' : aucun bouton « Importer » sur l\'écran');
  check(await page.evaluate(() => /import des résultats : Paramètres › Imports/i.test(document.getElementById('app').textContent)), nom + ' : ligne « import des résultats : Paramètres › Imports »');
  await page.context().close();
}
console.log('OK 1 Contrôle laitier PC et mobile : plus aucun bouton d\'import, ligne d\'information sous le titre.');

// ================================================================ 2. Paramètres › Imports (PC) : carte, écran intact, retour, import complet
const pc = await ouvrir(true);
await pc.evaluate(() => { parametresTab = 'imports'; render('parametres'); });
await pc.waitForSelector('#import-sieol-cl');
eq(await pc.evaluate(() => document.querySelector('#import-sieol-cl .prm-titre').textContent), 'Contrôle laitier · fichiers SIEOL', 'carte « Contrôle laitier · fichiers SIEOL »');
eq(await pc.evaluate(() => document.getElementById('dernier-sieol-cl').textContent), 'aucun', 'dernier import : aucun au départ');
await pc.click('#btn-import-controle-laitier-sieol');
await pc.waitForSelector('#import-cl-resume-file');
// écran d'import intact : campagne, C1/C2/C3, fichier résumé ET fichier cahier de contrôle
eq(await pc.evaluate(() => [!!document.getElementById('import-cl-campagne'), [...document.querySelectorAll('.cl-controle-opt')].map(b => b.textContent), !!document.getElementById('import-cl-resume-file'), !!document.getElementById('import-cl-cahier-file'), !!document.getElementById('btn-confirm-import-cl')]),
  [true, ['C1', 'C2', 'C3'], true, true, true], 'écran SIEOL intact : campagne, C1/C2/C3, fichier résumé, fichier cahier, confirmation');
// retour (flèche) -> Paramètres › Imports
await pc.click('#btn-back');
await pc.waitForSelector('#import-sieol-cl');
eq(await pc.evaluate(() => [currentView, parametresTab, document.querySelector('.tab-btn.active') && document.querySelector('.tab-btn.active').dataset.tab]), ['parametres', 'imports', 'imports'], 'retour : Paramètres, onglet Imports');
// import complet : résumé + cahier, C1 et C2, confirmation
await pc.click('#btn-import-controle-laitier-sieol');
await pc.waitForSelector('#import-cl-resume-file');
const avant = await pc.evaluate(() => { const b = DB.brebis.find(x => x.numeroCourtTravailSieol === '8134'); return { n: (b.controleLaitier || []).length, resumes: DB.resumeControleLaitier.length }; });
await pc.selectOption('#import-cl-campagne', '2026');
await pc.click('.cl-controle-opt[data-controle="1"]');
await pc.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from('num_controle;date_controle;lait_total;nb_brebis\n1;20/01/2027;1500;10\n') });
await pc.setInputFiles('#import-cl-cahier-file', { name: 'cahier.csv', mimeType: 'text/csv', buffer: Buffer.from('numero_visuel_sieol;ctl1_ml;ctl1_anomalie\n8134;1111;\n') });
await pc.waitForSelector('#btn-confirm-import-cl:not(.hidden)', { timeout: 5000 });
await pc.click('#btn-confirm-import-cl');
await pc.waitForSelector('#import-sieol-cl');
const apres = await pc.evaluate(() => { const b = DB.brebis.find(x => x.numeroCourtTravailSieol === '8134'); return { n: (b.controleLaitier || []).length, valeur: (b.controleLaitier || []).map(c => c.quantite), resumes: DB.resumeControleLaitier.length, vue: currentView, onglet: parametresTab, dernier: document.getElementById('dernier-sieol-cl').textContent }; });
check(apres.n === avant.n + 1 && apres.valeur.includes(1111) && apres.resumes === avant.resumes + 1, 'import : contrôle C1 de la brebis 8134 et résumé écrits comme avant : ' + JSON.stringify(apres));
eq([apres.vue, apres.onglet], ['parametres', 'imports'], 'fin de l\'import : retour à Paramètres › Imports');
check(/20-01-2027|campagne 2027/.test(apres.dernier) || /campagne 2027/.test(apres.dernier), 'dernier import mémorisé : ' + apres.dernier);
check((pc.__alertes || []).some(m => /1 valeur\(s\) de contrôle importée\(s\)/.test(m)), 'message de confirmation inchangé : ' + JSON.stringify(pc.__alertes));
console.log('OK 2 Paramètres › Imports : carte, écran SIEOL intact (campagne, C1/C2/C3, résumé et cahier), retour et fin d\'import vers Imports, dernier import mémorisé.');

// ================================================================ 3. mobile : Paramètres n'a pas d'Imports (PC uniquement)
const mob = await ouvrir(false);
await mob.evaluate(() => { parametresRubrique = null; render('parametres'); });
check(await mob.evaluate(() => !/fichiers SIEOL/.test(document.getElementById('app').textContent)), 'mobile : la carte d\'import n\'est pas proposée (les imports se font sur PC)');
console.log('OK 3 mobile : pas d\'imports (PC uniquement).');
await browser.close();
console.log('\nTOUS LES TESTS DES IMPORTS DU CONTRÔLE LAITIER SONT PASSÉS');
