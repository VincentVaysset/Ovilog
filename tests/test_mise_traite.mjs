/* « Mise à la traite » (mobile et PC). Une brebis attendue à la traite qu'on met à la traite (bouton en un geste, ou trouvées cochées dans le
   lot « Attendues à la traite » PUIS « Mettre les trouvées à la traite ») quitte les attendues et passe dans « Traites » (en attente du
   1er contrôle) ; date = jour de la mise à la traite ; bandeau 6 s avec « Annuler ». Exclusive avec « Pas traite cette campagne » (la dernière
   information gagne). Une brebis contrôlée avec une quantité n'est jamais « attendue ». Les six groupes de Brebis à régulariser restent
   exclusifs. Les autres lots de recherche gardent leurs coches sans bouton. saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const fiche = (n, x) => Object.assign({ id: 'b' + n, eid: '250000004569' + String(n).padStart(3, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, x || {});
    const mb = lambs => [{ date: '2026-10-12', campagne: 2026, codeRepro: 'MN', lambs }];
    const mortNe = { sexe: 'Mort-né', adopte: false };
    const vivant = n => ({ sexe: 'Mâle', adopte: false, eid: '250000004561' + String(n).padStart(3, '0'), sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-10-12' }] });
    DB.brebis = [
      fiche(1, { agnelages: mb([mortNe]) }),                                                                   // attendue
      fiche(2, { agnelages: mb([mortNe, mortNe]) }),                                                           // attendue
      fiche(3, { agnelages: mb([vivant(3)]) }),                                                                // allaitante
      fiche(4, { agnelages: mb([mortNe]), controleLaitier: [{ controle: 1, quantite: 1.5, campagne: 2026 }] }), // traite (contrôle)
      fiche(5)                                                                                                 // à régulariser
    ];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  });
  return page;
}
const sit = p => p.evaluate(() => Object.fromEntries(DB.brebis.map(s => { const S = situationTraiteCampagne(s); return [s.id, S.code + (S.source ? '/' + S.source : '')]; })));
const groupes = p => p.evaluate(() => { const G = bilanARegulariserData().groupes; return ['aRegulariser', 'allaitantes', 'attendues', 'traites', 'pasTraites', 'videsDefinitives'].map(k => G[k].map(b => b.id)); });

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. règle : une brebis traite n'est jamais attendue
  eq(await sit(p), { b1: 'attendue', b2: 'attendue', b3: 'allaitante', b4: 'traite', b5: 'aRegulariser' }, nom + ' : situations de départ');
  eq(await p.evaluate(() => attendueTraiteListe().map(b => b.id)), ['b1', 'b2'], nom + ' : accueil : la brebis contrôlée avec une quantité n\'est pas attendue');

  // ================================================================ 2. bouton « Mise à la traite » (Brebis à régulariser), bandeau, Annuler
  await p.evaluate(() => { bilanCampagneTab = 'incoherences'; render('bilan-campagne'); });
  eq(await p.evaluate(() => [...document.querySelectorAll('.btn-mise-traite')].map(b => b.dataset.id)), ['b1', 'b2'], nom + ' : bouton sur chaque attendue, à côté de « Pas traite »');
  await p.click('.btn-mise-traite[data-id="b1"]');
  const apres = await p.evaluate(() => ({ m: DB.brebis[0].miseTraite, snack: document.querySelector('.mt-snack') && document.querySelector('.mt-snack').innerText, txt: document.getElementById('app').textContent.replace(/\s+/g, ' ') }));
  eq(apres.m, [{ campagne: 2026, date: '2027-03-20' }], nom + ' : mise à la traite enregistrée à la date du jour');
  check(/n°69001 · mise à la traite/.test(apres.snack) && /Annuler/.test(apres.snack), nom + ' : bandeau : ' + apres.snack);
  check(/mise à la traite le 20\/03, en attente du 1er contrôle/.test(apres.txt), nom + ' : détail dans « Traites »');
  eq(await groupes(p), [['b5'], ['b3'], ['b2'], ['b1', 'b4'], [], []], nom + ' : six groupes exclusifs, b1 dans « Traites »');
  eq(await p.evaluate(() => [attendueTraiteListe().map(b => b.id), dashboardStatsData().attendueTraiteCount]), [['b2'], 1], nom + ' : accueil : b1 n\'est plus attendue');
  await p.click('#mt-snack-annuler');
  eq(await sit(p).then(x => x.b1), 'attendue', nom + ' : « Annuler » : de nouveau attendue');

  // ================================================================ 3. exclusive avec « Pas traite » ; contrôle Tarie / quantité
  const ex = await p.evaluate(() => {
    const b = DB.brebis[0], r = [];
    marquerMiseTraite(b); marquerNonTraite(b, 'Mammite'); r.push(situationTraiteCampagne(b).code, (b.miseTraite || []).length);
    marquerMiseTraite(b); r.push(situationTraiteCampagne(b).code, (b.nonTraite || []).length);
    b.controleLaitier = [{ controle: 1, quantite: null, anomalie: 9, campagne: 2026 }]; r.push(situationTraiteCampagne(b).code);
    b.controleLaitier = [{ controle: 1, quantite: 1.2, campagne: 2026 }]; const S = situationTraiteCampagne(b); r.push(S.code + '/' + (S.source || 'controle'));
    b.controleLaitier = []; retirerMiseTraite(b); r.push(situationTraiteCampagne(b).code);
    return r;
  });
  eq(ex, ['pasTraite', 0, 'traite', 0, 'pasTraite', 'traite/controle', 'attendue'], nom + ' : la dernière information gagne ; Tarie seul = pas traite ; quantité = traite');

  // ================================================================ 4. fiche : bouton, puis « Mise à la traite le … » + Annuler
  if (!bureau) {
    await p.evaluate(() => { ficheBrebisTabSheepId = 'b2'; ficheBrebisTab = 'repro'; currentSheepId = 'b2'; render('detail', 'b2'); });
    check(await p.evaluate(() => !!document.querySelector('#pt-badge-attendue .btn-mise-traite')), nom + ' : fiche : bouton dans le bandeau « Attendue à la traite »');
  }
  await p.evaluate(() => { ficheBrebisTabSheepId = 'b2'; ficheBrebisTab = 'ctrl'; currentSheepId = 'b2'; render('detail', 'b2'); });
  check(await p.evaluate(() => !!document.querySelector('#pt-bloc-fiche .btn-mise-traite')), nom + ' : fiche : bouton dans le bloc Traite');
  await p.click('#pt-bloc-fiche .btn-mise-traite');
  const fiche = await p.evaluate(() => document.getElementById('pt-bloc-fiche').innerText);
  check(/Mise à la traite le 20\/03/.test(fiche) && /en attente du 1er contrôle/.test(fiche), nom + ' : fiche : ' + fiche);
  check(await p.evaluate(() => !document.getElementById('pt-badge-attendue')), nom + ' : fiche : plus de bandeau « Attendue à la traite »');
  await p.click('#mt-fiche-annuler');
  eq(await sit(p).then(x => x.b2), 'attendue', nom + ' : fiche : Annuler');

  // ================================================================ 5. lot « Attendues à la traite » : cocher, PUIS « Mettre les trouvées à la traite »
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} openAutoLot('auto-attendues-traite', 'Attendues à la traite', attendueTraiteListe().map(b => b.eid)); });
  eq(await p.evaluate(() => { const b = document.getElementById('btn-mettre-traite'); return [b.disabled, b.textContent]; }), [true, 'Mettre les trouvées à la traite'], nom + ' : lot : bouton désactivé tant que rien n\'est coché');
  await p.click('.lot-check[data-eid="250000004569001"]');
  await p.click('.lot-check[data-eid="250000004569002"]');
  await p.click('.lot-check[data-eid="250000004569002"]');   // finalement écartée avant de valider
  eq(await p.evaluate(() => [document.getElementById('btn-mettre-traite').textContent, (DB.brebis[0].miseTraite || []).length]), ['Mettre les trouvées à la traite (1)', 0], nom + ' : cocher n\'enregistre rien');
  await p.click('#btn-mettre-traite');
  eq(await sit(p).then(x => [x.b1, x.b2]), ['traite/miseTraite', 'attendue'], nom + ' : seule la trouvée cochée est mise à la traite');
  eq(await p.evaluate(() => [document.getElementById('btn-mettre-traite').disabled, /mise à la traite/.test(document.querySelector('.mt-snack').innerText)]), [true, true], nom + ' : bouton revenu à zéro, bandeau');
  await p.click('#mt-snack-annuler');
  eq(await p.evaluate(() => [situationTraiteCampagne(DB.brebis[0]).code, document.getElementById('btn-mettre-traite').textContent]), ['attendue', 'Mettre les trouvées à la traite (1)'], nom + ' : Annuler : de nouveau attendue, coche gardée');
  // autre lot de recherche : coches seulement, pas de bouton
  await p.evaluate(() => { DB.lots.push({ id: 'lot-x', nom: 'Lot X', membres: [DB.brebis[0].eid], dateCreation: '2027-03-01' }); currentLotId = 'lot-x'; render('lot-search'); });
  check(await p.evaluate(() => !document.getElementById('btn-mettre-traite')), nom + ' : autre lot : pas de bouton');
  console.log('OK ' + nom + ' : mise à la traite (règle, groupes, bouton, bandeau, fiche, lot « Attendues à la traite »).');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « MISE À LA TRAITE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
