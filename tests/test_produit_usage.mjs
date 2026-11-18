/* Fiche produit : « À quoi il sert (facultatif) » (produitsInfo[nom].usage, 120 caractères, texte de l'éleveur toujours échappé).
   Saisi dans la fiche (création et modification), gardé quand une autre fenêtre réécrit la fiche, effacé si on vide le champ ;
   affiché sous le nom dans Produits et délais (PC tableau, mobile cartes), recherche « nom ou usage » ; rappelé dans le choix du
   produit du Carnet sanitaire ; les soins déjà enregistrés ne changent pas. Jeu SYNTHÉTIQUE, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const ctx = await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } });
  if (bureau) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.produits = Object.assign(DB.produits || {}, { vaccins: [], antibiotiques: ['Pénicilline Z'], antiparasitaires: ['Vermifuge Y'], antiinflammatoires: [], autres: [] });
    DB.produitsInfo = { 'Pénicilline Z': { delaiLait: 3, delaiViande: 10, delaiAttente: 3 }, 'Vermifuge Y': { delaiLait: 7, delaiViande: 14, delaiAttente: 7 } };
    DB.brebis = [{ id: 'b1', eid: '250000045600001', statut: 'active', createdAt: 1, mouvements: [], agnelages: [], echographies: [], controleLaitier: [], modesRepro: [], notes: [],
      sanitaire: [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Pénicilline Z', date: '2026-11-01', quantiteCc: 5, intervenant: 'Éleveur' }] }];
    window.__soins = JSON.stringify(DB.brebis[0].sanitaire);
    render('produits-delais');
  });
  await p.waitForTimeout(300);
  // création avec usage (piège d'échappement)
  await p.click('#pd-nouveau'); await p.waitForTimeout(200);
  await p.fill('#fp-nom', 'Diaprim');
  await p.click('#fp-type .opt-btn[data-val="Traitement"], #fp-type [data-val="Traitement"]');
  await p.selectOption('#fp-categorie', 'Antibiotique').catch(() => {});
  await p.fill('#fp-usage', 'Diarrhées des agneaux <b>x</b>');
  await p.fill('#fp-viande', '10'); await p.fill('#fp-lait', '3');
  await p.click('#fp-enregistrer, .modal-overlay .btn-primary');
  await p.waitForTimeout(300);
  eq(await p.evaluate(() => DB.produitsInfo.Diaprim && DB.produitsInfo.Diaprim.usage), 'Diarrhées des agneaux <b>x</b>', nom + ' : usage enregistré tel quel');
  check(await p.evaluate(() => [...document.querySelectorAll('.pd-usage')].some(e => e.textContent === 'Diarrhées des agneaux <b>x</b>') && !document.querySelector('.pd-usage b')), nom + ' : usage affiché sous le nom, échappé');
  // recherche par usage
  await p.fill('#pd-recherche', 'diarrh');
  const vis = await p.$$eval('#pc-produits-delais .pd-ligne', ls => ls.filter(l => l.style.display !== 'none').map(l => l.dataset.recherche));
  eq(vis.length, 1, nom + ' : la recherche « diarrh » ne garde que le produit dont l\'usage correspond');
  // une autre écriture de la fiche (ex. confirmation) garde l'usage ; modifier en vidant le champ l'efface
  eq(await p.evaluate(() => { ecrireFicheProduit('Diaprim', { delaiLait: 3, delaiViande: 10, posologie: '' }); return DB.produitsInfo.Diaprim.usage; }), 'Diarrhées des agneaux <b>x</b>', nom + ' : usage gardé par une autre écriture de la fiche');
  // Carnet : rappelé dans le choix du produit
  const opt = await p.evaluate(() => { const t = produitsDuTypeCategorie('Traitement', 'Antibiotique'); return t.includes('Diaprim'); });
  check(opt, nom + ' : produit proposé au Carnet');
  eq(await p.evaluate(() => JSON.stringify(DB.brebis[0].sanitaire) === window.__soins), true, nom + ' : soins déjà enregistrés inchangés');
  eq(erreurs, [], nom + ' : aucune erreur JavaScript');
  await ctx.close();
}
await browser.close();
console.log('OK test_produit_usage');
