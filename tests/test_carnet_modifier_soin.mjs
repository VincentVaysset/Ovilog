/* Carnet sanitaire, corriger un soin (PC et mobile) : « Derniers soins » porte Modifier / Suppr. sur CHAQUE soin, même après d'autres saisies (avant :
   seul « Annuler ce lot » du tout dernier enregistrement) ; traitement collectif : Modifier (toutes les copies + historique), Animaux › Retirer (un seul
   animal, historique à jour), Suppr. (tout le lot) ; agneau sans n° compris ; suppression en UN geste, bandeau 6 s « Annuler » = soins exacts d'avant ;
   un champ vidé à la modification est retiré du soin (soinModifie) ; suppression depuis la fiche : l'historique collectif suit ; « Voir tous les soins ».
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: [], antibiotiques: ['Produit A', 'Produit B'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { 'Produit A': { delaiLait: 7, delaiViande: 28, surOrdonnance: false }, 'Produit B': { delaiLait: 3, delaiViande: 10, surOrdonnance: false } };
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('601023', 'b1'), fiche('669002', 'b2'), fiche('670193', 'b3')];
  DB.ordonnances = [{ id: 'o1', numero: 'ORD-1', date: '2026-11-01', veterinaire: 'Vétérinaire A', produits: [] }];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.brebis[1].agnelages = [{ date: '2026-11-10', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false }] }];
};

for (const mobile of [true, false]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1500, height: 1100 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const T = mobile ? 'mobile' : 'PC';
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  let dialogues = 0;
  p.on('dialog', d => { dialogues++; d.accept(); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  check(await p.evaluate(() => isDesktopMode()) === !mobile, T + ' : mode attendu');
  const SOINS = mobile ? '#cs-cartes-derniers .carte-liste' : '#cs-table-derniers tr:not(:first-child)';
  const saisir = async (produit, eids, ordonnance) => {
    await p.evaluate(() => { carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire'); });
    await p.selectOption('#cs-produit', produit); await p.fill('#cs-dose', '2'); await p.selectOption('#cs-voie', { index: 1 });
    if (ordonnance) await p.selectOption('#cs-ordonnance', ordonnance);
    await p.click('#cs-suivant'); await p.waitForSelector(mobile ? '#cs-cards' : '#cs-table');
    for (const e of eids) await p.click((mobile ? '#cs-cards .sheep-item' : '#cs-table tr.clic') + `[data-eid="${e}"]`);
    await p.click('#cs-enregistrer'); await p.waitForSelector('#cs-dernier-lot');
    await p.click('#cs-onglet-soins'); await p.waitForSelector(SOINS);   // les soins enregistrés sont dans l'onglet « Soins réalisés »
  };
  const san = i => p.evaluate(i => JSON.parse(JSON.stringify(DB.brebis[i].sanitaire)), i);
  const soinAgneau = () => p.evaluate(() => JSON.parse(JSON.stringify(DB.brebis[1].agnelages[0].lambs[0].sanitaire || [])));
  const bouton = async (cls, texte) => { const b = await p.$$(SOINS); for (const r of b) { if ((await r.textContent()).includes(texte)) return r.$(cls); } throw new Error('ligne introuvable : ' + texte); };

  // 1. soin individuel b1, puis un autre soin : le premier reste corrigeable
  await saisir('Produit A', ['250000045601023'], 'ORD-1');
  await saisir('Produit B', ['250000045670193']);
  check(await p.evaluate(s => document.querySelectorAll(s + ' .cs-soin-modifier').length === 2 && document.querySelectorAll(s + ' .cs-soin-suppr').length === 2, SOINS), T + ' : Modifier / Suppr. sur chaque soin');
  await (await bouton('.cs-soin-modifier', '01023')).click();
  await p.waitForSelector('#cs-suivant');
  check(await p.evaluate(() => /Modifier le soin/.test(document.getElementById('cs-suivant').textContent) || /Enregistrer les modifications/.test(document.getElementById('cs-suivant').textContent)), T + ' : formulaire de modification');
  await p.fill('#cs-dose', '3'); await p.selectOption('#cs-ordonnance', '');
  await p.click('#cs-suivant'); await p.waitForSelector(SOINS);
  let s0 = (await san(0))[0];
  check(s0.quantiteCc === 3 && s0.produit === 'Produit A' && !('numeroOrdonnance' in s0) && s0.id, T + ' : modifié (dose), ordonnance vidée = retirée, id gardé : ' + JSON.stringify(s0));
  check(await p.evaluate(() => currentView === 'sanitaire' && !carnetSanitaireEtat.editing), T + ' : retour au Carnet');

  // 2. supprimer en un geste, puis Annuler = soin exact
  const avant = JSON.stringify(await san(0));
  const dAvant = dialogues;
  await (await bouton('.cs-soin-suppr', '01023')).click();
  eq(await san(0), [], T + ' : supprimé');
  eq(dialogues, dAvant, T + ' : supprimé en un geste, sans confirm()');
  check(await p.evaluate(() => /Produit A supprimé · 023|Produit A supprimé · n°01023/.test(document.querySelector('.cs-snack').textContent)), T + ' : bandeau « supprimé »');
  await p.click('#cs-snack-annuler');
  eq(JSON.stringify(await san(0)), avant, T + ' : Annuler = soin exact d\'avant');
  check(!(await p.$('.cs-snack')), T + ' : bandeau fermé');

  // 3. traitement collectif (b1, b2, agneau sans n°) : modifier toutes les copies, retirer un animal, supprimer le lot
  await saisir('Produit A', ['250000045601023', '250000045669002', 'sansn:b2:0:0']);
  const tc = () => p.evaluate(() => JSON.parse(JSON.stringify(DB.traitementsCollectifs)));
  const tc0 = (await tc())[0];
  eq(tc0.membres.length, 3, T + ' : historique collectif à 3 animaux');
  await (await bouton('.cs-soin-modifier', '3 animaux')).click();
  await p.waitForSelector('#cs-suivant');
  check(await p.evaluate(() => /Traitement collectif · 3 animaux/.test(document.getElementById('cs-ecran').textContent)), T + ' : mention du traitement collectif');
  await p.fill('#cs-dose', '5'); await p.selectOption('#cs-produit', 'Produit B'); await p.fill('#cs-dose', '5');
  await p.click('#cs-suivant'); await p.waitForSelector(SOINS);
  const copies = async () => [(await san(0)).find(x => x.collectifId), (await san(1)).find(x => x.collectifId), (await soinAgneau()).find(x => x.collectifId)];
  check((await copies()).every(x => x && x.produit === 'Produit B' && x.quantiteCc === 5 && x.collectifId === tc0.id), T + ' : toutes les copies modifiées : ' + JSON.stringify(await copies()));
  check((await tc())[0].produit === 'Produit B' && (await tc())[0].quantiteCc === 5, T + ' : historique collectif à jour');

  await (await bouton('.cs-soin-animaux', '3 animaux')).click();
  await p.waitForSelector('#cs-animaux-soin');
  const nRet = await p.evaluate(() => document.querySelectorAll('#cs-animaux-soin .cs-retirer-animal').length);
  eq(nRet, 3, T + ' : les 3 animaux du lot');
  const iAg = await p.evaluate(() => [...document.querySelectorAll('#cs-animaux-soin .cs-retirer-animal')].findIndex(b => /sans n°/.test(b.parentElement.textContent)));
  await p.click(`#cs-animaux-soin .cs-retirer-animal[data-i="${iAg}"]`);
  check(!(await soinAgneau()).some(x => x.collectifId), T + ' : agneau sans n° retiré du lot');
  eq((await tc())[0].membres.length, 2, T + ' : historique collectif : 2 animaux');
  await p.click('#cs-snack-annuler');
  check((await soinAgneau()).some(x => x.collectifId) && (await tc())[0].membres.length === 3, T + ' : Annuler : l\'agneau revient, historique à 3');

  await (await bouton('.cs-soin-suppr', '3 animaux')).click();
  check(!(await copies()).some(Boolean) && (await tc()).length === 0, T + ' : lot entier supprimé (copies et historique)');
  await p.click('#cs-snack-annuler');
  check((await copies()).every(Boolean) && (await tc()).length === 1 && (await tc())[0].membres.length === 3, T + ' : Annuler : lot entier rétabli');

  // 4. suppression depuis la fiche (glisser, inchangé) : l'historique collectif suit
  await p.evaluate(() => { currentSheepId = 'b1'; const i = DB.brebis[0].sanitaire.findIndex(x => x.collectifId); deleteItem('sanitaire', i); });
  eq((await tc())[0].membres.length, 2, T + ' : suppression sur la fiche : historique à 2 animaux');

  // 5. soin individuel sur l'agneau sans n° : modifiable et supprimable depuis le Carnet
  await saisir('Produit A', [await p.evaluate(() => DB.brebis[1].agnelages[0].lambs[0].ref)]);
  await saisir('Produit B', ['250000045670193']);
  await (await bouton('.cs-soin-suppr', 'Mâle de n°69002 (sans n°)')).click();
  check((await soinAgneau()).filter(x => !x.collectifId).length === 0, T + ' : soin individuel de l\'agneau sans n° supprimé');

  // 6. « Voir tous les soins » au-delà de 15
  await p.evaluate(() => { for (let k = 0; k < 40; k++) DB.brebis[2].sanitaire.push({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Produit B', date: '2026-10-0' + (k % 9 + 1), quantiteCc: 1 }); carnetSanitaireEtat = null; carnetOnglet = 'soins'; render('sanitaire'); });
  const n = () => p.evaluate(s => document.querySelectorAll(s).length, SOINS);
  eq(await n(), 30, T + ' : 30 derniers');
  await p.click('#cs-voir-tous-soins');
  check(await n() > 30, T + ' : Voir tous');
  await p.click('#cs-voir-tous-soins');
  eq(await n(), 30, T + ' : retour aux 30 derniers');
  await ctx.close();
}
await browser.close();
console.log('OK test_carnet_modifier_soin');
