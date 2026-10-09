/* Refonte Paramètres, partie 0 : structure. PC : 5 onglets dans l'ordre Exploitation, Campagne, Listes, Imports, Sauvegarde, chacun avec un titre et une ligne d'explication.
   Mobile : plus d'onglets, un écran d'arrivée à 4 rubriques (Exploitation, Campagne, Listes, Sauvegarde ; pas d'Imports) avec un résumé chacune, qui ouvrent chacune leur écran avec retour
   (flèche de l'en-tête) ; état de synchro et version en pied ; retour d'un sous-écran (Gérer les produits) sur la bonne rubrique ; le menu rouvre toujours l'écran d'arrivée. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const jeu = (page) => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = { ...DB.exploitation, nom: 'Galibert Clément', numeroCheptel: '12241205', indicatifMarquage: '162991', prefixeEid: '162991' };
  parametresTab = 'exploitation'; parametresRubrique = null;
});
const txt = (page, sel) => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

// ================================================================ PC
{
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await jeu(page);
  await page.evaluate(() => render('parametres'));
  eq(await page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.textContent)), ['Exploitation', 'Campagne', 'Listes', 'Imports', 'Sauvegarde'], 'PC : 5 onglets dans l\'ordre demandé');
  const aides = { Exploitation: "L'identité de l'élevage et la synchronisation entre appareils", Campagne: 'La campagne en cours et les réglages qui servent aux calculs de reproduction', Listes: 'Les choix proposés dans les menus déroulants', Imports: 'Fichiers Excel au modèle Ovilog · disponible sur PC uniquement', Sauvegarde: "Tes données et la version de l'application" };
  for (const [nom, aide] of Object.entries(aides)) {
    await page.click(`.tab-bar .tab-btn:text-is("${nom}")`);
    eq(await txt(page, '.brd-title'), nom, 'titre de l\'onglet ' + nom);
    check((await txt(page, '.brd-sub')).includes(aide), 'ligne d\'explication de ' + nom + ' : ' + await txt(page, '.brd-sub'));
    check(await page.evaluate(() => document.querySelector('.tab-btn.active').textContent) === nom, 'onglet actif ' + nom);
    check(await page.evaluate(() => !!document.querySelector('#parametres-tab-content .prm-grid')), 'cartes en grille PC (' + nom + ')');
  }
  console.log('OK PC : 5 onglets dans l\'ordre, titre + explication par onglet, grille de cartes.');
  await page.close();
}

// ================================================================ MOBILE
{
  const page = await (await browser.newContext({ viewport: { width: 420, height: 1100 } })).newPage();
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await jeu(page);
  await page.evaluate(() => render('parametres'));
  check(await page.evaluate(() => !document.querySelector('.tab-bar')), 'mobile : plus d\'onglets');
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-rub .prm-rub-titre')].map(e => e.textContent)), ['Exploitation', 'Campagne', 'Listes', 'Sauvegarde'], 'mobile : 4 rubriques, pas d\'Imports');
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-rub .prm-rub-resume')].map(e => e.textContent)), ['Galibert Clément · cheptel 12241205', 'Campagne 2027 · réglages de reproduction', '6 listes · acheteurs, causes de mortalité…', 'Aucune sauvegarde vérifiée sur cet appareil'], 'résumés des rubriques');
  check(/Synchronisation|Connexion|Hors ligne/.test(await txt(page, '#prm-accueil-sync')) && /Version .* · les imports de fichiers se font sur PC/.test(await txt(page, '.prm-pied')), 'pied : état de synchro + version : ' + await txt(page, '.prm-pied'));
  check(await page.evaluate(() => !document.getElementById('btn-back').classList.contains('hidden') === false && !document.getElementById('btn-menu').classList.contains('hidden')), 'écran d\'arrivée : menu visible, pas de flèche de retour');
  // une rubrique + retour
  for (const [cle, titre] of [['exploitation', 'Paramètres · Exploitation'], ['campagne', 'Paramètres · Campagne'], ['listes', 'Paramètres · Listes'], ['sauvegarde', 'Paramètres · Sauvegarde']]) {
    await page.click(`.prm-rub[data-rub="${cle}"]`);
    eq(await txt(page, '#page-title'), titre, 'titre de la rubrique ' + cle);
    check(await page.evaluate(() => !document.getElementById('btn-back').classList.contains('hidden') && document.getElementById('btn-menu').classList.contains('hidden')), 'rubrique ' + cle + ' : flèche de retour visible');
    check(await page.evaluate(() => !!document.querySelector('#parametres-tab-content .card')), 'cartes affichées (' + cle + ')');
    await page.click('#btn-back');
    check(await page.evaluate(() => !!document.querySelector('.prm-rub')) && await txt(page, '#page-title') === 'Paramètres', 'retour à l\'écran d\'arrivée depuis ' + cle);
  }
  // sous-écran (Gérer les produits) : retour sur la rubrique Listes
  await page.click('.prm-rub[data-rub="listes"]');
  await page.click('#btn-gerer-produits');
  await page.click('#btn-back');
  eq(await txt(page, '#page-title'), 'Paramètres · Listes', 'retour de « Gérer les produits » : rubrique Listes');
  // le menu rouvre toujours l'écran d'arrivée
  await page.evaluate(() => { parametresRubrique = 'campagne'; render('home'); });
  await page.click('#btn-menu'); await page.click('.nav-item[data-view="parametres"]');
  check(await page.evaluate(() => !!document.querySelector('.prm-rub')), 'le menu rouvre l\'écran d\'arrivée');
  console.log('OK mobile : écran d\'arrivée à 4 rubriques (résumés, pied), chaque rubrique avec retour, retour de sous-écran, menu.');
  await page.close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE LA STRUCTURE DE PARAMÈTRES SONT PASSÉS');
