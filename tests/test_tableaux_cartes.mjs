/* Chantier « Tableaux mobile en cartes » : sur téléphone (360 et 390 px), AUCUN tableau visible ni défilement horizontal sur les écrans qui en avaient (Historique des échographies, Ordonnances,
   Sous délai d'attente, Carnet sanitaire, Produits et délais avec « anciennes valeurs à confirmer », Inventaire sur ses 4 onglets, Lot de recherche, Soins sans bio avec des lignes) ; la page ne défile
   jamais de côté ; chaque carte fait 56 px au moins ; les cartes qui s'ouvrent (ordonnances, inventaire) ont un chevron et les autres non ; les actions d'avant restent là (Modifier / Supprimer…) ;
   le PC garde ses tableaux. Jeux synthétiques, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
import { jeuSoinsSansBio } from './lib/jeu_soins_sans_bio.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const SANS_BIO = 'soins-sans-bio';
// [nom, jeu, code d'affichage, nombre minimal de cartes attendues]
const ECRANS = [
  ['Historique des échographies', 'pc', "render('historique-echo')", 2],
  ['Ordonnances', 'pc', "render('ordonnances')", 1],
  ['Sous délai d\'attente', 'pc', "render('sous-delai')", 1],
  ['Carnet sanitaire', 'pc', "render('sanitaire')", 4],
  ['Produits et délais', 'pc', "render('produits-delais')", 3],
  ['Inventaire · brebis', 'pc', "inventaireActifsTab = 'brebis'; render('inventaire-actifs')", 5],
  ['Inventaire · agnelles', 'pc', "inventaireActifsTab = 'agnelles'; render('inventaire-actifs')", 2],
  ['Inventaire · béliers', 'pc', "inventaireActifsTab = 'beliers'; render('inventaire-actifs')", 2],
  ['Inventaire · agneaux', 'pc', "inventaireActifsTab = 'agneaux'; render('inventaire-actifs')", 2],
  ['Lot de recherche', 'pc', "currentLotId = 'L1'; render('lot-search')", 2],
  ['Soins sans bio', 'bio', "render('soins-sans-bio')", 4],
  ['Mise à jour d\'inventaire (inchangée)', 'pc', "DB.majInventaireSession = { eids: [DB.brebis[0].eid, DB.brebis[1].eid] }; render('maj-inventaire')", 0]
];
const mesure = () => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const cartes = [...document.querySelectorAll('#app .carte-liste')].filter(vis);
  return {
    tables: [...document.querySelectorAll('#app table')].filter(vis).length,
    defilants: [...document.querySelectorAll('#app *')].filter(e => { const cs = getComputedStyle(e); return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1 && vis(e); }).length,
    page: document.documentElement.scrollWidth - innerWidth,
    cartes: cartes.length, minH: cartes.length ? Math.round(Math.min(...cartes.map(c => c.getBoundingClientRect().height))) : null,
    chevronsFaux: cartes.filter(c => !!c.querySelector('.carte-liste-chev') !== c.classList.contains('ouvre')).length
  };
};
for (const w of [360, 390]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: 800 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  let jeuCourant = null;
  for (const [nom, jeu, code, mini] of ECRANS) {
    if (jeuCourant !== jeu) {
      if (jeu === 'bio') await page.evaluate(jeuSoinsSansBio, true);
      else { await page.evaluate(jeuPcEcrans); await page.evaluate(() => { DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: true }); DB.produitsInfo = Object.assign({}, DB.produitsInfo, { Ivomec: { posologie: null, delaiAttente: 3 } }); DB.ordonnances = [{ id: 'O1', numero: 'ORD-1', date: '2026-10-01', veterinaire: 'Dr Martin', produits: [{ nom: 'Intramicine' }, { nom: 'Ivomec' }] }]; }); }
      jeuCourant = jeu;
    }
    await page.evaluate((c) => { parametresRubrique = null; (0, eval)(c); }, code); await page.waitForTimeout(200);
    const m = await page.evaluate(mesure);
    check(m.tables === 0 && m.defilants === 0 && m.page <= 0, w + ' px · ' + nom + ' : aucun tableau visible, aucun défilement horizontal, page sans défilement latéral : ' + JSON.stringify(m));
    check(m.cartes >= mini, w + ' px · ' + nom + ' : au moins ' + mini + ' carte(s), obtenu ' + m.cartes);
    if (m.cartes) check(m.minH >= 56 && m.chevronsFaux === 0, w + ' px · ' + nom + ' : cartes de 56 px au moins (' + m.minH + ') et chevron seulement sur les cartes qui s\'ouvrent');
  }
  // couverture : les « anciennes valeurs à confirmer » sont bien affichées en cartes sur Produits et délais
  await page.evaluate(jeuPcEcrans); await page.evaluate(() => { DB.produitsInfo = Object.assign({}, DB.produitsInfo, { Ivomec: { posologie: null, delaiAttente: 3 } }); render('produits-delais'); });
  eq(await page.evaluate(() => [produitsAConfirmer().length > 0, document.querySelectorAll('#pd-cartes-anciennes .carte-liste').length > 0, document.querySelectorAll('#pc-produits-delais table').length]), [true, true, 0], w + ' px · anciennes valeurs à confirmer en cartes');
  // actions conservées
  await page.evaluate(() => render('historique-echo'));
  eq(await page.evaluate(() => [document.querySelectorAll('.btn-edit-histo-echo').length > 0, document.querySelectorAll('.btn-del-histo-echo').length > 0]), [true, true], w + ' px · Historique : Modifier / Supprimer conservés');
  await page.evaluate(() => render('produits-delais'));
  eq(await page.evaluate(() => [document.querySelectorAll('.pd-modifier').length > 0, document.querySelectorAll('.pd-supprimer').length > 0, document.querySelectorAll('.pd-confirmer').length > 0, document.querySelectorAll('.pd-corriger').length > 0]), [true, true, true, true], w + ' px · Produits : Modifier / Supprimer / Confirmer / Corriger conservés');
  // Soins sans bio : écran de téléphone (tuiles, barre fixe, compteur), cocher une carte met à jour le compteur
  await page.evaluate(jeuSoinsSansBio, true); await page.evaluate(() => render('soins-sans-bio'));
  const sb = await page.evaluate(() => ({ tuiles: document.querySelectorAll('#pc-soins-sans-bio .tuile-charte').length, pcKpis: document.querySelectorAll('.pc-kpis').length, barre: !!document.querySelector('.mn-barre #sb-appliquer'), retour: !!document.getElementById('sb-retour'), compteur: document.getElementById('sb-n').textContent }));
  eq([sb.tuiles, sb.pcKpis, sb.barre, sb.retour], [4, 0, true, false], w + ' px · Soins sans bio : 4 tuiles, plus de bandeau PC, barre fixe, pas de bouton « Retour au carnet » en doublon');
  await page.click('#sb-cartes .carte-liste[data-i="1"]');
  const apres = await page.evaluate(() => document.getElementById('sb-n').textContent);
  check(apres !== sb.compteur, w + ' px · cocher une carte change le compteur : ' + sb.compteur + ' → ' + apres);
  await page.click('#sb-rien'); eq(await page.evaluate(() => document.querySelectorAll('#sb-cartes .sb-chk:checked').length), 0, w + ' px · Tout décocher');
  await page.click('#sb-tout'); eq(await page.evaluate(() => [document.querySelectorAll('#sb-cartes .sb-chk:checked').length, document.querySelectorAll('#sb-cartes .carte-liste').length]), [4, 4], w + ' px · Tout cocher');
  await page.close();
}
// PC inchangé : les tableaux sont toujours là
{
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeuPcEcrans); await page.evaluate(() => { DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: true }); });
  for (const [nom, code] of [['Ordonnances', "render('ordonnances')"], ['Sous délai d\'attente', "render('sous-delai')"], ['Produits et délais', "render('produits-delais')"], ['Inventaire', "inventaireActifsTab = 'brebis'; render('inventaire-actifs')"], ['Lot de recherche', "currentLotId = 'L1'; render('lot-search')"]]) {
    await page.evaluate((c) => { (0, eval)(c); }, code); await page.waitForTimeout(150);
    eq(await page.evaluate(() => [[...document.querySelectorAll('#app table')].filter(t => t.getBoundingClientRect().width > 0).length > 0, document.querySelectorAll('#app .carte-liste').length]), [true, 0], 'PC · ' + nom + ' : tableau conservé, aucune carte');
  }
  await page.evaluate(jeuSoinsSansBio, true); await page.evaluate(() => render('soins-sans-bio'));
  eq(await page.evaluate(() => [!!document.getElementById('sb-table'), document.querySelectorAll('.pc-kpis').length, document.querySelectorAll('#sb-cartes').length]), [true, 1, 0], 'PC · Soins sans bio : tableau et bandeau de tuiles conservés');
  await page.close();
}
await browser.close();
console.log('\nTOUS LES TESTS « TABLEAUX MOBILE EN CARTES » SONT PASSÉS.');
