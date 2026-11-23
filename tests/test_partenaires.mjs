/* Documents de circulation, étape 1, point 2 : Partenaires. La liste des noms (`acheteurs`) reste telle quelle ; fiche à côté (`partenairesInfo`) :
   catégorie en 6 choix en mots simples (« Où vont les animaux ? D'où viennent-ils ? »), aucun code visible ; n° EDE (FR + 8, message ambre) ou n° d'agrément
   (abattoir), rien pour particulier / autre ; SIREN ; adresse en 3 champs ; « Notifie à ma place » jamais cochée d'office. Carte « Catégories à reprendre » :
   catégorie PROPOSÉE d'après le nom, écrite seulement par « Valider », Annuler exact. Renommer = mouvements actifs suivis, fiche déplacée. Liste du compte
   synchronisée (aller-retour exact). Noms fictifs. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
for (const pc of [true, false]) {
  const nom = pc ? 'PC' : 'mobile';
  const ctx = await browser.newContext({ viewport: pc ? { width: 1400, height: 950 } : { width: 400, height: 860 } });
  const page = await ctx.newPage();
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => { window.OvilogSync = window.OvilogSync || {}; window.OvilogSync.reglagesAdmin = () => ({ connu: true, data: { notificationEde: true } }); }); // chantier EDE activé (interrupteur administrateur)
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2027; DB.campagneInitialisee = true;
    DB.acheteurs = ['Coop Exemple', 'Acheteur C'];
    DB.brebis = [{ id: 'b1', eid: '250000045651001', statut: 'vendue', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements: [{ type: 'Vente', acheteur: 'Acheteur C', date: '2026-11-10' }] }];
    DB.beliers = []; DB.agnelles = [];
    parametresTab = 'listes'; parametresRubrique = 'listes'; render('parametres');
  });
  check(await page.isVisible('#liste-acheteurs #btn-gerer-partenaires') && /Partenaires/.test(await page.textContent('#liste-acheteurs .prm-titre')) && /2 à compléter/.test(await page.textContent('#liste-acheteurs')), nom + ' : carte « Partenaires » (noms comme avant) avec « Fiches partenaires » et le nombre à compléter');
  await page.click('#btn-gerer-partenaires');
  eq(await page.evaluate(() => [currentView, document.querySelectorAll('.pt-reprise').length]), ['partenaires', 2], nom + ' : écran Partenaires, 2 catégories à reprendre');
  eq(await page.evaluate(() => [...document.querySelectorAll('.pt-reprise')].map(r => r.innerText.replace(/\s+/g, ' ').trim())),
    ['Coop Exemple Proposition : une coopérative ou un négociant Valider Changer', 'Acheteur C Catégorie à choisir Choisir'], nom + ' : proposition d\'après le nom, rien d\'écrit');
  eq(await page.evaluate(() => DB.partenairesInfo || null), null, nom + ' : aucune fiche écrite d\'office');
  // aucun code visible
  const texte = await page.evaluate(() => document.body.innerText);
  check(!/\b(10|31|32|34|40)\b/.test(texte), nom + ' : aucun code de catégorie affiché');
  // Valider puis Annuler
  await page.click('.pt-valider[data-nom="Coop Exemple"]');
  eq(await page.evaluate(() => DB.partenairesInfo['Coop Exemple']), { categorie: 'cooperative' }, nom + ' : Valider écrit la catégorie proposée');
  await page.click('#sup-snack-annuler');
  eq(await page.evaluate(() => 'Coop Exemple' in (DB.partenairesInfo || {})), false, nom + ' : Annuler = fiche exacte d\'avant (aucune)');
  // fiche : Acheteur C en abattoir, n° d'agrément, adresse ; délégation non cochée d'office
  await page.click('.pt-completer[data-nom="Acheteur C"]');
  check(await page.isVisible('#fiche-partenaire'), nom + ' : fiche ouverte');
  eq(await page.evaluate(() => [document.querySelectorAll('.pt-cat').length, document.getElementById('pt-delegataire').checked, !!document.getElementById('pt-numero')]), [6, false, false], nom + ' : 6 choix, délégation décochée, pas de n° avant la catégorie');
  check(!/\b(10|31|32|34|40)\b/.test(await page.evaluate(() => document.getElementById('fiche-partenaire').innerText)), nom + ' : aucun code dans la fiche');
  await page.click('.pt-cat[data-cat="eleveur"]');
  await page.fill('#pt-numero', '1234');
  check(await page.isVisible('#pt-numero-format'), nom + ' : n° EDE faux = message ambre');
  await page.click('.pt-cat[data-cat="abattoir"]');
  eq(await page.evaluate(() => [document.querySelector('label[for="pt-numero"]').textContent, document.getElementById('pt-numero').value]), ["N° d'agrément sanitaire", '1234'], nom + ' : abattoir = n° d\'agrément, saisie gardée');
  await page.fill('#pt-numero', 'FR 12.000.001');
  await page.fill('#pt-adresse', 'Zone artisanale');
  await page.fill('#pt-cp', '12000'); await page.fill('#pt-commune', 'Commune-Test');
  await page.click('#pt-enregistrer');
  eq(await page.evaluate(() => [DB.partenairesInfo['Acheteur C'], DB.acheteurs]), [{ categorie: 'abattoir', numero: 'FR 12.000.001', adresse: 'Zone artisanale', codePostal: '12000', commune: 'Commune-Test' }, ['Coop Exemple', 'Acheteur C']],
    nom + ' : fiche enregistrée (champs vides et délégation non cochée absents), liste des noms inchangée');
  eq(await page.evaluate(() => [manquesPartenaire('Acheteur C'), manquesPartenaire('Coop Exemple'), codeCategoriePartenaire('abattoir'), codeCategoriePartenaire('particulier')]), [[], ['catégorie'], '40', null], nom + ' : manques et code (fonction seule)');
  // nouveau partenaire éleveur délégataire, puis renommage
  await page.click('#pt-nouveau');
  await page.fill('#pt-nom', 'GAEC Exemple');
  await page.click('#pt-enregistrer');
  check(/Choisissez/.test(await page.textContent('#pt-err')), nom + ' : catégorie obligatoire');
  await page.click('.pt-cat[data-cat="eleveur"]');
  await page.fill('#pt-numero', 'FR 12345678');
  await page.check('#pt-delegataire');
  await page.click('#pt-enregistrer');
  eq(await page.evaluate(() => [DB.acheteurs.includes('GAEC Exemple'), DB.partenairesInfo['GAEC Exemple']]), [true, { categorie: 'eleveur', numero: 'FR 12345678', delegataire: true }], nom + ' : nouveau partenaire, délégation cochée à la main');
  await page.evaluate(() => ouvrirFichePartenaire('Acheteur C'));
  await page.fill('#pt-nom', 'Abattoir Exemple');
  await page.click('#pt-enregistrer');
  eq(await page.evaluate(() => [DB.acheteurs.includes('Acheteur C'), DB.acheteurs.includes('Abattoir Exemple'), 'Acheteur C' in DB.partenairesInfo, DB.partenairesInfo['Abattoir Exemple'].categorie, DB.brebis[0].mouvements[0].acheteur]),
    [false, true, false, 'abattoir', 'Abattoir Exemple'], nom + ' : renommer = nom, fiche et mouvements suivis');
  // liste du compte : aller-retour exact
  eq(await page.evaluate(() => JSON.stringify(recordVersListeCompte(listeCompteVersRecord('partenairesInfo', DB.partenairesInfo))) === JSON.stringify(DB.partenairesInfo) && champsListesCompte().includes('partenairesInfo')), true, nom + ' : liste du compte synchronisée, aller-retour exact');
  eq(erreurs, [], nom + ' : aucune erreur de page');
  await ctx.close();
}
await browser.close();
console.log('test_partenaires : OK');
