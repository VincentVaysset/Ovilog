/* Catégories des soins « Autre » : liste de COMPTE (Paramètres › Listes, « Ajouter… »), choisie sur la fiche d'un produit « Autres » (ex. Séléphérol en « Vitamines
   et minéraux ») ; Carnet sanitaire : catégorie prise de la fiche, modifiable (plus de « Soin de plaie » imposé) ; soins au bouclage : catégorie de la fiche ; anciens
   soins restés en « Soin de plaie » : corrigés en UN geste depuis la fiche produit (ligne seulement s'il y en a, Annuler = valeurs exactes d'avant), registre archivé jamais
   touché. saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);

// 0. compte neuf : liste de départ
eq(await p.evaluate(() => migrateData({}).categoriesSoinsAutres), ['Vitamines et minéraux', 'Soin de plaie', 'Désinfection', 'Digestif et réhydratation', 'Homéopathie et phytothérapie', 'Autre'], 'liste de départ (sans Reproduction)');

await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: [], antibiotiques: [], antiparasitaires: [], antiinflammatoires: [], autres: ['Séléphérol', 'Spray A'] };
  DB.produitsInfo = { 'Séléphérol': { delaiLait: 0, delaiViande: 0, delaiAttente: 0, surOrdonnance: false, bouclage: { doseCc: 2, voie: 'Sous-cutanée' } }, 'Spray A': { delaiLait: 0, delaiViande: 0, delaiAttente: 0 } };
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2023-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('669002', 'b1')]; DB.beliers = []; DB.agnelles = []; DB.lots = [];
  const sp = (o) => Object.assign({ type: 'Autre', produit: 'Séléphérol', date: '2026-11-05', quantiteCc: 2 }, o);
  DB.brebis[0].agnelages = [{ date: '2026-11-05', campagne: 2026, codeRepro: 'MN', lambs: [
    { sexe: 'Mâle', eid: '250000045671045', sanitaire: [sp({ id: 'a', sousType: 'Soin de plaie' })] },
    { sexe: 'Femelle', eid: '250000045671046', sanitaire: [sp({ id: 'b', bouclage: true }), { id: 'c', type: 'Autre', sousType: 'Soin de plaie', produit: 'Spray A', date: '2026-11-06' }] }] }];
  DB.brebis[0].sanitaire = [sp({ id: 'd', sousType: 'Soin de plaie' })];
  DB.registre = { brebis: { '250000045699999': { eid: '250000045699999', sanitaire: [sp({ id: 'r', sousType: 'Soin de plaie' })], mouvements: [] } }, beliers: {}, agnelles: {} };
});
const sousTypes = () => p.evaluate(() => { const L = DB.brebis[0].agnelages[0].lambs; return [L[0].sanitaire[0].sousType, L[1].sanitaire[0].sousType, L[1].sanitaire[1].sousType, DB.brebis[0].sanitaire[0].sousType, DB.registre.brebis['250000045699999'].sanitaire[0].sousType]; });

// 1. fiche produit « Autres » : catégorie du soin ; ligne de correction en un geste
await p.evaluate(() => ouvrirFicheProduitModal({ nom: 'Séléphérol', onSaved: () => {} }));
check(await p.isVisible('#fp-categorie'), 'fiche d\'un produit « Autres » : choix de la catégorie du soin');
check(await p.evaluate(() => !document.getElementById('fp-corr-ligne') && document.getElementById('fp-categorie').value === ''), 'catégorie pas encore choisie (« À choisir ») : aucune ligne de correction, rien d\'écrit d\'office');
await p.selectOption('#fp-categorie', 'Vitamines et minéraux');
check(await p.evaluate(() => /3 soins déjà enregistrés en Soin de plaie/.test(document.getElementById('fp-corr-ligne').textContent)), 'ligne « 3 soins déjà enregistrés en Soin de plaie » (agneaux, brebis, bouclage sans catégorie ; autre produit et registre archivé exclus)');
await p.click('#fp-corr-ok');
eq(await sousTypes(), ['Vitamines et minéraux', 'Vitamines et minéraux', 'Soin de plaie', 'Vitamines et minéraux', 'Soin de plaie'], 'correction : les 3 soins de Séléphérol, rien d\'autre');
await p.click('#fp-corr-annuler');
eq(await sousTypes(), ['Soin de plaie', null, 'Soin de plaie', 'Soin de plaie', 'Soin de plaie'].map(x => x === null ? undefined : x).map(x => x), 'Annuler : valeurs exactes d\'avant (soin sans catégorie remis sans catégorie)');
await p.click('#fp-corr-ok');
await p.click('#fp-ok');
eq(await p.evaluate(() => DB.produitsInfo['Séléphérol'].categorieSoin), 'Vitamines et minéraux', 'fiche enregistrée avec sa catégorie');
await p.evaluate(() => ouvrirFicheProduitModal({ nom: 'Séléphérol', onSaved: () => {} }));
check(await p.evaluate(() => !document.getElementById('fp-corr-ligne') && document.getElementById('fp-categorie').value === 'Vitamines et minéraux'), 'plus rien à corriger : la ligne ne revient pas');
await p.evaluate(() => document.querySelector('.modal-overlay').remove());

// 2. soin au bouclage : catégorie de la fiche
eq(await p.evaluate(() => soinBouclage({ produit: 'Séléphérol', doseCc: 2, voie: 'Sous-cutanée' }, '2026-11-10').sousType), 'Vitamines et minéraux', 'soin au bouclage : catégorie de la fiche');

// 3. Carnet sanitaire : type Autre → catégorie libre, prise de la fiche, « Ajouter… »
await p.evaluate(() => { carnetSanitaireEtat = null; render('sanitaire'); });
await p.click('.cs-type[data-val="Autre"]');
check(await p.evaluate(() => { const s = document.getElementById('cs-categorie'); return !s.disabled && [...s.options].some(o => o.value === 'Désinfection') && [...s.options].some(o => o.value === '__ajouter__'); }), 'Carnet : catégorie d\'un soin « Autre » modifiable (liste + Ajouter…)');
await p.selectOption('#cs-produit', 'Séléphérol');
eq(await p.inputValue('#cs-categorie'), 'Vitamines et minéraux', 'Carnet : catégorie prise de la fiche produit');
await p.selectOption('#cs-categorie', 'Désinfection');
eq(await p.evaluate(() => [carnetSanitaireEtat.produit, construireSoinCarnet(carnetSanitaireEtat).sousType]), ['Séléphérol', 'Désinfection'], 'Carnet : catégorie modifiable, le produit reste');

// 4. registre sanitaire : la vraie catégorie
check(await p.evaluate(() => registreSanitaireRows().some(r => r.type === 'Autre · Vitamines et minéraux')), 'registre sanitaire : « Autre · Vitamines et minéraux »');

// 5. Paramètres › Listes : la liste existe, compte ses usages
eq(await p.evaluate(() => [!!configListe('categoriesSoinsAutres'), compterUsageCategorieSoinAutre('Vitamines et minéraux'), valeurProtegee('categoriesSoinsAutres', 'Soin de plaie')]), [true, 3, true], 'Paramètres › Listes : liste, usages, « Soin de plaie » protégée');
await browser.close();
const src = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/);
check(src && /'categoriesSoinsAutres'/.test(src[0]), 'liste synchronisée (META_FIELDS)');
console.log('\nTOUS LES TESTS « CATÉGORIES DES SOINS AUTRE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
