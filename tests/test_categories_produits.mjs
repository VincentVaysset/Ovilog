/* Produits et soins : UN rangement partout (fiche produit, Carnet, Produits et délais, Paramètres › Listes, mobile et PC) : Type (Vaccin / Traitement /
   Autre) puis Catégorie prise dans la liste du compte, « Ajouter… » des deux côtés. Traitement de départ (Antibiotique…) = sa liste historique ; traitement
   ajouté par l'éleveur = liste « autres » + fiche { typeSoin: 'Traitement', categorieSoin } ; produits existants inchangés. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const ctx = await browser.newContext(bureau ? { viewport: { width: 1400, height: 1000 } } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.produits = { vaccins: ['Vaccin A'], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: ['Spray A'] };
    DB.produitsInfo = { 'Vaccin A': { delaiLait: 0, delaiViande: 0 }, 'Produit A': { delaiLait: 5, delaiViande: 21 }, 'Spray A': { delaiLait: 0, delaiViande: 0, categorieSoin: 'Désinfection' } };
    window.__avant = JSON.stringify({ p: DB.produits, i: DB.produitsInfo });
  });

  // 1. lecture : produits existants inchangés, même Type + Catégorie qu'avant
  eq(await p.evaluate(() => ['Vaccin A', 'Produit A', 'Spray A'].map(n => typeSoinProduit(n))), [{ type: 'Vaccin', categorie: '' }, { type: 'Traitement', categorie: 'Antibiotique' }, { type: 'Autre', categorie: 'Désinfection' }], nom + ' : produits existants lus comme avant');
  eq(await p.evaluate(() => DB.categoriesTraitements), ['Antibiotique', 'Antiparasitaire', 'Anti-inflammatoire'], nom + ' : liste de départ des catégories de traitement');

  // 2. fiche produit : Type puis Catégorie ; « Ajouter… » une catégorie de traitement
  await p.evaluate(() => { render('produits-delais'); ouvrirFicheProduitModal({ onSaved: () => render('produits-delais') }); });
  await p.waitForSelector('#fp-type');
  eq(await p.evaluate(() => [[...document.querySelectorAll('#fp-type .tab-btn')].map(b => b.textContent), !!document.querySelector('#fp-type .active'), document.getElementById('fp-categorie-zone').style.display]), [['Vaccin', 'Traitement', 'Autre'], false, 'none'], nom + ' : Type à choisir, aucune catégorie avant le type');
  await p.fill('#fp-nom', 'Produit B');
  await p.click('#fp-type .tab-btn[data-val="Traitement"]');
  eq(await p.evaluate(() => [...document.getElementById('fp-categorie').options].map(o => o.textContent)), ['À choisir', 'Antibiotique', 'Antiparasitaire', 'Anti-inflammatoire', 'Ajouter…'], nom + ' : catégories de traitement + « Ajouter… »');
  await p.selectOption('#fp-categorie', '__ajouter__');
  await p.waitForTimeout(150);
  await p.waitForSelector('#liste-ajout-input');
  await p.fill('#liste-ajout-input', 'Traitement pulmonaire'); await p.click('#liste-ajout-ok'); await p.waitForTimeout(150);
  eq(await p.evaluate(() => [document.getElementById('fp-categorie').value, DB.categoriesTraitements.includes('Traitement pulmonaire')]), ['Traitement pulmonaire', true], nom + ' : catégorie ajoutée à la liste du compte et choisie');
  await p.fill('#fp-viande', '7'); await p.fill('#fp-lait', '3');
  await p.click('#fp-ok');
  eq(await p.evaluate(() => [DB.produits.autres.includes('Produit B'), DB.produitsInfo['Produit B'].typeSoin, DB.produitsInfo['Produit B'].categorieSoin, JSON.stringify(typeSoinProduit('Produit B'))]), [true, 'Traitement', 'Traitement pulmonaire', '{"type":"Traitement","categorie":"Traitement pulmonaire"}'], nom + ' : traitement ajouté rangé avec sa catégorie');
  check(await p.evaluate(() => /Traitement · Traitement pulmonaire/.test(document.getElementById('app').textContent)), nom + ' : Produits et délais : carte « Traitement · Traitement pulmonaire »');

  // 3. traitement de départ : liste historique ; type obligatoire, catégorie obligatoire pour un traitement
  await p.evaluate(() => ouvrirFicheProduitModal({}));
  await p.fill('#fp-nom', 'Produit C'); await p.fill('#fp-viande', '0'); await p.fill('#fp-lait', '0');
  await p.click('#fp-ok');
  check(await p.evaluate(() => /Choisis le type/.test(document.getElementById('fp-err').textContent)), nom + ' : type obligatoire, jamais par défaut');
  await p.click('#fp-type .tab-btn[data-val="Traitement"]'); await p.click('#fp-ok');
  check(await p.evaluate(() => /catégorie du traitement/.test(document.getElementById('fp-err').textContent)), nom + ' : catégorie obligatoire pour un traitement');
  await p.selectOption('#fp-categorie', 'Antiparasitaire'); await p.click('#fp-ok');
  eq(await p.evaluate(() => [DB.produits.antiparasitaires.includes('Produit C'), DB.produitsInfo['Produit C'].typeSoin || null, DB.produitsInfo['Produit C'].categorieSoin || null]), [true, null, null], nom + ' : traitement de départ dans sa liste historique');

  // 4. Carnet : mêmes listes ; le produit ajouté n'est proposé que sous Traitement · Traitement pulmonaire
  await p.evaluate(() => { carnetSanitaireEtat = null; render('sanitaire'); });
  await p.click('.cs-type[data-val="Traitement"]');
  eq(await p.evaluate(() => [...document.getElementById('cs-categorie').options].map(o => o.textContent)), ['Antibiotique', 'Antiparasitaire', 'Anti-inflammatoire', 'Traitement pulmonaire', 'Ajouter…'], nom + ' : Carnet, mêmes catégories de traitement + « Ajouter… »');
  await p.selectOption('#cs-categorie', 'Traitement pulmonaire');
  eq(await p.evaluate(() => [...document.getElementById('cs-produit').options].map(o => o.value).filter(v => v && v !== '__nouveau__')), ['Produit B'], nom + ' : Carnet, produit de cette catégorie seulement');
  await p.click('.cs-type[data-val="Autre"]');
  eq(await p.evaluate(() => [...document.getElementById('cs-produit').options].map(o => o.value).filter(v => v && v !== '__nouveau__')), ['Spray A'], nom + ' : Carnet, « Autre » sans le traitement ajouté');

  // 5. Paramètres › Listes : la nouvelle liste
  check(await p.evaluate(() => LISTES_GENERALES_CONFIG.some(c => c.key === 'categoriesTraitements' && c.protegees.includes('Antibiotique'))), nom + ' : liste « Catégories des traitements », valeurs de départ protégées');
  console.log('OK ' + nom);
  await ctx.close();
}
await browser.close();
console.log('\nTOUS LES TESTS « UN SEUL RANGEMENT DES PRODUITS ET DES SOINS » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
