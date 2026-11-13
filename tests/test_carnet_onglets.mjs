/* Carnet sanitaire en onglets (mobile et PC) : Nouveau soin | Soins réalisés | Sous délai | Produits | Ordonnances (carnetOnglet, ongletCarnetDeVue) ;
   Nouveau soin = le parcours seul (plus de « Derniers soins » ni « En délai d'attente » dessous) ; Soins réalisés = tous les soins, filtres n° / période /
   type / produit / catégories (soinsRealisesCarnet), exports qui suivent les filtres (lignesSanitaireSoinsRealises) ; Sous délai, Produits, Ordonnances
   ouverts du Carnet = onglets (menu, pas de retour), ouverts d'ailleurs = écran d'avant (retour d'origine, pas d'onglets) ; écran 2 : millésimes
   multiples (décochés exclus), lot Tous / Dans le lot / Hors du lot / Aucun lot (listes automatiques jamais comptées). saveData REMPLACÉ ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: ['Vaccin B'], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { 'Produit A': { delaiLait: 7, delaiViande: 28 }, 'Vaccin B': { delaiLait: 0, delaiViande: 0 } };
  const fiche = (n, id) => ({ id, eid: '2500000456' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [fiche('20101', 'b1'), fiche('20102', 'b2'), fiche('60103', 'b3'), fiche('60104', 'b4')];
  const soin = (p, d, t) => ({ type: t || 'Traitement', sousType: t ? null : 'Antibiotique', produit: p, date: d, quantiteCc: 2, voie: 'Orale', dureeJours: 1, intervenant: 'Éleveur' });
  DB.brebis[0].sanitaire = [soin('Produit A', '2026-10-05'), soin('Vaccin B', '2026-11-02', 'Vaccin')];
  DB.brebis[2].sanitaire = [soin('Produit A', '2026-11-10')];
  DB.brebis[1].agnelages = [{ date: '2026-11-08', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false, ref: 'AG-x', sanitaire: [soin('Produit A', '2026-11-09')] }] }];
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.lots = [{ id: 'L1', nom: 'Lot IA 2026', type: 'reproduction', membres: [DB.brebis[0].eid, DB.brebis[2].eid] }, { id: 'auto-attendues-traite', nom: 'Attendues à la traite', auto: true, membres: [DB.brebis[1].eid] }];
};

for (const mobile of [true, false]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const T = mobile ? 'mobile' : 'PC';
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  await p.evaluate(() => { carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire'); });

  // 1. Nouveau soin : les onglets, le parcours seul
  eq(await p.evaluate(() => [...document.querySelectorAll('.cs-onglets .tab-btn')].map(b => b.dataset.onglet)), ['nouveau', 'soins', 'sousdelai', 'produits', 'ordonnances'], T + ' : 5 onglets');
  check(await p.evaluate(() => !document.getElementById('cs-derniers') && !document.getElementById('cs-en-delai') && !!document.getElementById('cs-suivant')), T + ' : Nouveau soin = le formulaire seul');
  check(await p.evaluate(() => !document.getElementById('btn-back') || document.getElementById('btn-back').classList.contains('hidden')), T + ' : écran de tête (pas de retour)');

  // 2. Soins réalisés : tous les soins, filtres
  await p.click('#cs-onglet-soins');
  const lignes = () => p.evaluate(m => [...document.querySelectorAll(m ? '#cs-cartes-derniers .carte-liste' : '#cs-table-derniers tr:not(:first-child)')].map(e => e.textContent.replace(/\s+/g, ' ')), mobile);
  eq((await lignes()).length, 4, T + ' : tous les soins (agneau sans n° compris)');
  check(/10-11-2026|10\/11\/2026/.test((await lignes())[0]), T + ' : le plus récent en haut');
  await p.fill('#cs-sr-q', '69002'.slice(0, 0) + '20102');   // n° de la mère : son agneau sans n°
  eq((await lignes()).length, 1, T + ' : n° de la mère = le soin de son agneau sans n°');
  check(/sans n°/.test((await lignes())[0]), T + ' : agneau sans n° par sa mère');
  await p.fill('#cs-sr-q', '');
  await p.selectOption('#cs-sr-type', 'Vaccin');
  eq((await lignes()).length, 1, T + ' : filtre type');
  await p.selectOption('#cs-sr-type', '');
  await p.fill('#cs-sr-du', '2026-11-01');
  eq((await lignes()).length, 3, T + ' : filtre période (du)');
  await p.fill('#cs-sr-au', '2026-11-05');
  eq((await lignes()).length, 1, T + ' : filtre période (du… au…)');
  await p.fill('#cs-sr-du', ''); await p.fill('#cs-sr-au', '');
  await p.click('.cs-sr-cat[data-cat="agneaux"]');
  eq((await lignes()).length, 3, T + ' : sans les agneaux');
  await p.selectOption('#cs-sr-produit', 'Produit A');
  eq((await lignes()).length, 2, T + ' : filtre produit');
  // exports : mêmes lignes que l'écran
  eq(await p.evaluate(() => lignesSanitaireSoinsRealises(soinsRealisesCarnet(carnetSoinsF)).map(r => r.produit + ' ' + r.date)), ['Produit A 2026-11-10', 'Produit A 2026-10-05'], T + ' : les exports suivent les filtres');
  check(await p.evaluate(() => !!document.getElementById('cs-export') && !!document.getElementById('cs-export-pdf') && document.getElementById('cs-export').compareDocumentPosition(document.getElementById('cs-export-pdf')) & Node.DOCUMENT_POSITION_FOLLOWING), T + ' : Export Excel puis Export PDF');
  check(await p.evaluate(async () => { let n = 0; const orig = saveOrShareBinaryFile; saveOrShareBinaryFile = async (f, b) => { n += b && b.length ? 1 : 0; }; await exportSoinsRealisesPdf(); await exportSoinsRealisesXlsx(); saveOrShareBinaryFile = orig; return n === 2; }), T + ' : PDF et Excel produits');
  await p.evaluate(() => { carnetSoinsF = null; });

  // 3. Sous délai, Produits, Ordonnances : onglets quand on vient du Carnet
  for (const [id, vue] of [['#cs-sous-delai', 'sous-delai'], ['#cs-produits', 'produits-delais'], ['#cs-ordonnances', 'ordonnances']]) {
    await p.click(id);
    check(await p.evaluate(v => currentView === v && !!document.querySelector('.cs-onglets .tab-btn.active') && document.getElementById('page-title').textContent === 'Carnet sanitaire'
      && document.getElementById('btn-back').classList.contains('hidden'), vue), T + ' : ' + vue + ' ouvert comme onglet du Carnet');
  }
  await p.click('#cs-onglet-nouveau');
  check(await p.evaluate(() => currentView === 'sanitaire' && carnetOnglet === 'nouveau'), T + ' : retour à Nouveau soin');
  // ouverts d'ailleurs : écran d'avant
  await p.evaluate(() => { sousDelaiOrigine = 'home'; render('sous-delai'); });
  check(await p.evaluate(() => !document.querySelector('.cs-onglets') && !document.getElementById('btn-back').classList.contains('hidden')), T + ' : Sous délai depuis l\'Accueil : pas d\'onglets, retour gardé');
  await p.evaluate(() => { sousDelaiOrigine = null; produitsDelaisOrigine = 'parametres'; render('produits-delais'); });
  check(await p.evaluate(() => !document.querySelector('.cs-onglets')), T + ' : Produits depuis Paramètres : pas d\'onglets');
  await p.evaluate(() => { produitsDelaisOrigine = null; });

  // 4. écran 2 : millésimes multiples, lot dans / hors / aucun
  await p.evaluate(() => { carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire'); });
  await p.selectOption('#cs-produit', 'Produit A'); await p.fill('#cs-dose', '2'); await p.selectOption('#cs-voie', { index: 1 });
  await p.click('#cs-suivant'); await p.waitForSelector('#cs-millesimes');
  const visibles = () => p.evaluate(m => [...document.querySelectorAll(m ? '#cs-cards .sheep-item' : '#cs-table tr.clic')].map(e => e.dataset.eid).filter(e => !/^(sansn|AG-)/.test(e)).map(e => e.slice(-5)).sort(), mobile);
  eq(await visibles(), ['20101', '20102', '60103', '60104'], T + ' : départ : tout');
  const mill6 = await p.evaluate(() => String(anneeNaissance(DB.brebis[2].eid)));
  await p.click(`#cs-millesimes .cs-mill[data-m="${mill6}"]`);
  eq(await visibles(), ['20101', '20102'], T + ' : un millésime décoché');
  await p.click(`#cs-millesimes .cs-mill[data-m="${mill6}"]`);
  await p.click('#cs-lot-mode .tab-btn[data-mode="hors"]');
  await p.selectOption('#cs-flot', 'L1');
  eq(await visibles(), ['20102', '60104'], T + ' : hors du lot IA');
  await p.click('#cs-lot-mode .tab-btn[data-mode="dans"]');
  await p.selectOption('#cs-flot', 'L1');
  eq(await visibles(), ['20101', '60103'], T + ' : dans le lot IA');
  await p.click('#cs-lot-mode .tab-btn[data-mode="aucun"]');
  eq(await visibles(), ['20102', '60104'], T + ' : aucun lot (la liste automatique « Attendues à la traite » ne compte pas)');
  check(await p.evaluate(() => !document.getElementById('cs-flot')), T + ' : aucun lot : pas de lot à choisir');
  await ctx.close();
}
await browser.close();
console.log('OK test_carnet_onglets');
