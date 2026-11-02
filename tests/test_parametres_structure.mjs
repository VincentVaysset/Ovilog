/* Refonte Paramètres, partie 0 : structure. PC : 6 onglets dans l'ordre Exploitation, Campagne, Règles d'élevage, Listes, Imports, Synchro et sauvegarde, chacun avec un titre et une ligne d'explication.
   Mobile : plus d'onglets, un écran d'arrivée à 5 rubriques (Exploitation, Campagne, Listes, Lecteur, Sauvegarde ; pas d'Imports) avec un résumé chacune, qui ouvrent chacune leur écran avec retour
   (flèche de l'en-tête) ; état de synchro et version en pied ; retour d'un sous-écran (Produits et délais) sur la bonne rubrique ; le menu rouvre toujours l'écran d'arrivée. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const jeu = (page) => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = { ...DB.exploitation, nom: 'Exploitation B', numeroCheptel: '00000001', indicatifMarquage: '000121', prefixeEid: '000121' };
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
  eq(await page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].map(b => b.textContent)), ['Exploitation', 'Campagne', "Règles d'élevage", 'Listes', 'Imports', 'Synchro et sauvegarde'], 'PC : 5 onglets dans l\'ordre demandé');
  const aides = { Exploitation: "L'identité de l'élevage : suivi laitier, laiterie, bio", Campagne: 'La campagne en cours et ses dates', "Règles d'élevage": "Les règles que l'appli applique, pour tous les appareils du compte", Listes: 'Les choix proposés dans les menus déroulants', Imports: 'Fichiers Excel au modèle Ovilog · disponible sur PC uniquement', 'Synchro et sauvegarde': "Ton compte, tes données, la version de l'application, l'aide et le contact" };
  for (const [nom, aide] of Object.entries(aides)) {
    await page.click(`.tab-bar .tab-btn:text-is("${nom}")`);
    eq(await txt(page, '.brd-title'), nom, 'titre de l\'onglet ' + nom);
    check((await txt(page, '.brd-sub')).includes(aide), 'ligne d\'explication de ' + nom + ' : ' + await txt(page, '.brd-sub'));
    check(await page.evaluate(() => document.querySelector('.tab-btn.active').textContent) === nom, 'onglet actif ' + nom);
    check(await page.evaluate(() => !!document.querySelector('#parametres-tab-content .prm-grid, #parametres-tab-content .prm-cols')), 'cartes en grille PC (' + nom + ')');
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
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-rub .prm-rub-titre')].map(e => e.textContent)), ['Exploitation', 'Campagne', "Règles d'élevage", 'Listes', 'Lecteur', 'Synchro et sauvegarde'], 'mobile : 5 rubriques (dont Lecteur), pas d\'Imports');
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-rub .prm-rub-resume')].map(e => e.textContent)), ['Exploitation B · cheptel 00000001', 'Campagne 2027 et ses dates', 'Reproduction, mises bas, lait', '8 listes · acheteurs, causes de mortalité…', 'À régler dans l\'appli du téléphone', 'Aucune sauvegarde vérifiée sur cet appareil'], 'résumés des rubriques');
  check(/Synchronisation|Connexion|Hors ligne/.test(await txt(page, '#prm-accueil-sync')) && /Version .* · les imports de fichiers se font sur PC/.test(await txt(page, '.prm-pied')), 'pied : état de synchro + version : ' + await txt(page, '.prm-pied'));
  check(await page.evaluate(() => !document.getElementById('btn-back').classList.contains('hidden') === false && !document.getElementById('btn-menu').classList.contains('hidden')), 'écran d\'arrivée : menu visible, pas de flèche de retour');
  // une rubrique + retour
  for (const [cle, titre] of [['exploitation', 'Paramètres · Exploitation'], ['campagne', 'Paramètres · Campagne'], ['listes', 'Paramètres · Listes'], ['regles', "Paramètres · Règles d'élevage"], ['sauvegarde', 'Paramètres · Synchro et sauvegarde']]) {
    await page.click(`.prm-rub[data-rub="${cle}"]`);
    eq(await txt(page, '#page-title'), titre, 'titre de la rubrique ' + cle);
    check(await page.evaluate(() => !document.getElementById('btn-back').classList.contains('hidden') && document.getElementById('btn-menu').classList.contains('hidden')), 'rubrique ' + cle + ' : flèche de retour visible');
    check(await page.evaluate(() => !!document.querySelector('#parametres-tab-content .card')), 'cartes affichées (' + cle + ')');
    await page.click('#btn-back');
    check(await page.evaluate(() => !!document.querySelector('.prm-rub')) && await txt(page, '#page-title') === 'Paramètres', 'retour à l\'écran d\'arrivée depuis ' + cle);
  }
  // sous-écran (Produits et délais, ouvert depuis la carte « Produits sanitaires ») : retour sur la rubrique Listes
  await page.click('.prm-rub[data-rub="listes"]');
  await page.click('#btn-gerer-produits');
  check(await page.evaluate(() => currentView === 'produits-delais'), 'la carte « Produits sanitaires » ouvre « Produits et délais » (seul écran de création des produits)');
  await page.click('#btn-back');
  eq(await txt(page, '#page-title'), 'Paramètres · Listes', 'retour de « Produits et délais » : rubrique Listes');
  // le menu rouvre toujours l'écran d'arrivée
  await page.evaluate(() => { parametresRubrique = 'campagne'; render('home'); });
  await page.click('#btn-menu'); await page.click('.nav-item[data-view="parametres"]');
  check(await page.evaluate(() => !!document.querySelector('.prm-rub')), 'le menu rouvre l\'écran d\'arrivée');
  console.log('OK mobile : écran d\'arrivée à 5 rubriques (résumés, pied), chaque rubrique avec retour, retour de sous-écran, menu.');
  await page.close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE LA STRUCTURE DE PARAMÈTRES SONT PASSÉS');
