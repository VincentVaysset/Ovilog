/* Chantier de tri, partie b : PARCOURS MOBILE à 360 et 390 px -- Garder, Écarter, Reconsidérer, Annuler (bandeau « n°… · Annuler », sans confirm()), le scan ou le n° tapé SÉLECTIONNE
   sans valider, plusieurs candidats = liste de choix sans sélection automatique, une vendue ou morte sort seule de « À trier », aucun tableau, aucun défilement horizontal.
   RESTAURATION EXACTE : Reconsidérer une gardée puis Annuler remet la fiche telle qu'elle était (soins, notes, mouvements, place dans la liste). Jeu synthétique, saveData remplacé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
let reponse = true; const confirms = [];
for (const largeur of [360, 390]) {
  const page = await (await browser.newContext({ viewport: { width: largeur, height: 800 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    window.E = (d, n) => '2500000121' + d + String(n).padStart(4, '0');
    const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
    const l = (n, extra) => Object.assign({ eid: E(6, n), sexe: 'Femelle', sanitaire: [], mouvements: [] }, extra || {});
    DB.brebis = [
      f(8, 1, { agnelages: [{ campagne: 2025, date: '2026-01-14', codeRepro: 'IA', lambs: [l(1), l(2), l(3)] }] }),
      f(8, 2, { agnelages: [{ campagne: 2025, date: '2026-01-20', codeRepro: 'EP', lambs: [l(4), l(5, { statutFinal: 'vendu' }), l(6, { statutFinal: 'mort' })] }] }),
      f(8, 3, { agnelages: [{ campagne: 2025, date: '2026-01-25', lambs: [l(7, { eid: '2500000122' + '60001' }), l(8)] }] })      // 2500000122 60001 : même n° d'ordre que 60001 (ambigu)
    ];
    DB.agnelles = [];
    window.__avant = JSON.stringify(DB);
  });
  const ouvrir = async (o) => { await page.evaluate((o) => { triMobileScan = null; triMobileToast = null; triMobileOnglet = o || 'aTrier'; render('agnelles'); }, o); await page.waitForSelector('#scan-tri'); };
  const nbCartes = () => page.evaluate(() => document.querySelectorAll('.carte-liste').length);
  const sansDebord = async (m) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth && document.querySelectorAll('table').length === 0), largeur + ' px : ni tableau ni défilement horizontal (' + m + ')');
  await ouvrir(); await sansDebord('À trier');
  // vendue / morte absentes de « À trier » (7 femelles : 5 vendue et 6 morte sortent seules)
  const nums = await page.evaluate(() => [...document.querySelectorAll('.carte-liste .carte-liste-nm')].map(x => x.textContent));
  check(JSON.stringify(nums) === JSON.stringify(['n°60001', 'n°60002', 'n°60003', 'n°60004', 'n°60001', 'n°60008']), largeur + ' px : à trier = 6 femelles (plus âgées d\'abord, puis n° croissant), sans la vendue (60005) ni la morte (60006) : ' + JSON.stringify(nums));
  check(!nums.includes('n°60005') && !nums.includes('n°60006'), 'vendue et morte absentes');
  await page.evaluate(() => { findLambByEid(E(6, 4)).statutFinal = 'vendu'; render('agnelles'); });
  check(!(await page.evaluate(() => [...document.querySelectorAll('.carte-liste-nm')].map(x => x.textContent))).includes('n°60004'), 'une agnelle vendue après coup disparaît seule de la liste');
  await page.evaluate(() => { delete findLambByEid(E(6, 4)).statutFinal; render('agnelles'); });
  // Garder + Annuler, Écarter + Annuler : un geste, aucun confirm, bandeau
  confirms.length = 0; const n0 = await nbCartes();
  await page.click('.btn-garder >> nth=0');
  check(confirms.length === 0 && /gardée/.test(await page.evaluate(() => document.getElementById('tri-toast').textContent)) && await nbCartes() === n0 - 1 && await page.evaluate(() => DB.agnelles.length) === 1, largeur + ' px : Garder en un geste, sans confirm, bandeau, la carte quitte « À trier »');
  await sansDebord('après Garder');
  await page.click('#tri-toast-annuler');
  check(await nbCartes() === n0 && await page.evaluate(() => DB.agnelles.length) === 0, 'Annuler : la carte revient, la fiche est supprimée');
  await page.click('.btn-ecarter >> nth=0');
  check(confirms.length === 0 && await page.evaluate(() => DB.brebis.flatMap(b => b.agnelages.flatMap(a => a.lambs)).filter(x => x.triStatut === 'écartée').length) === 1 && await nbCartes() === n0 - 1, 'Écarter en un geste, sans confirm');
  await page.click('#tri-toast-annuler');
  check(await page.evaluate(() => !DB.brebis.flatMap(b => b.agnelages.flatMap(a => a.lambs)).some(x => x.triStatut)), 'Annuler l\'écartement');
  // onglets Gardées / Écartées : Reconsidérer
  await page.click('.btn-garder >> nth=0'); await page.waitForTimeout(50);
  await page.click('.btn-ecarter >> nth=0');
  await ouvrir('gardees'); await sansDebord('Gardées');
  check(await nbCartes() === 1, 'une gardée dans l\'onglet Gardées');
  await ouvrir('ecartees'); await sansDebord('Écartées');
  await page.click('.btn-reconsiderer');
  check(await page.evaluate(() => !DB.brebis.flatMap(b => b.agnelages.flatMap(a => a.lambs)).some(x => x.triStatut === 'écartée')) && confirms.length === 0, 'Reconsidérer une écartée : un geste');
  await page.click('#tri-toast-annuler');
  check(await page.evaluate(() => DB.brebis.flatMap(b => b.agnelages.flatMap(a => a.lambs)).some(x => x.triStatut === 'écartée')), 'Annuler : de nouveau écartée');
  // scan / n° tapé = sélection sans validation
  await page.evaluate(() => { DB.agnelles = []; DB.brebis.forEach(b => b.agnelages.forEach(a => a.lambs.forEach(x => { delete x.triStatut; }))); window.__saves = 0; window.__avant = JSON.stringify(DB); });
  await ouvrir();
  await page.fill('#scan-tri', await page.evaluate(() => E(6, 3))); await page.press('#scan-tri', 'Enter');
  check(await nbCartes() === 1 && await page.evaluate(() => document.querySelector('.carte-liste').classList.contains('sel')) && /Trouvée/.test(await page.evaluate(() => document.querySelector('.carte-liste').textContent)), largeur + ' px : le scan sélectionne (cadre, « Trouvée »)');
  check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'le scan ne valide rien');
  await sansDebord('après un scan');
  // plusieurs candidats (n° 60001 deux fois) : liste de choix, aucune sélection automatique
  await ouvrir();
  await page.fill('#scan-tri', '60001'); await page.press('#scan-tri', 'Enter');
  check(await page.evaluate(() => document.querySelectorAll('#scan-err .eid-candidate-chip').length) === 2 && await page.evaluate(() => document.querySelectorAll('.carte-liste.sel').length) === 0 && await page.evaluate(() => JSON.stringify(DB) === window.__avant), largeur + ' px : n° ambigu = liste de choix, rien de sélectionné ni validé');
  await page.click('#scan-err .eid-candidate-chip >> nth=1');
  check(await nbCartes() === 1 && await page.evaluate(() => document.querySelectorAll('.carte-liste.sel').length) === 1, 'choisir un candidat le sélectionne');
  await sansDebord('candidat choisi');

  // ================= RESTAURATION EXACTE de la fiche (Reconsidérer + Annuler)
  await page.evaluate(() => {
    const mk = (id, n, extra) => Object.assign({ id, eid: E(6, n), origine: 'née', motherEid: E(8, 1), dateEntree: '2026-09-01', sanitaire: [], notes: [], mouvements: [{ type: 'Naissance', cause: null, date: '2026-01-14' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-09-01' }] }, extra || {});
    DB.agnelles = [mk('a1', 1), mk('a2', 2, { sanitaire: [{ date: '2026-09-15', produit: 'Vitamine B12', dose: '2 mL' }, { date: '2026-09-20', produit: 'Vermifuge' }], notes: [{ date: '2026-09-18', texte: 'Petite, à surveiller' }], mouvements: [{ type: 'Naissance', cause: null, date: '2026-01-14' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-09-01' }, { type: 'Transfert', cause: 'Changement de lot', date: '2026-09-25' }] }), mk('a3', 3)];
    [1, 2, 3].forEach(n => { findLambByEid(E(6, n)).triStatut = 'gardée'; });
    window.__fiches = JSON.stringify(DB.agnelles); window.__lambs = JSON.stringify([1, 2, 3].map(n => findLambByEid(E(6, n))));
  });
  await ouvrir('gardees');
  reponse = false; confirms.length = 0;
  await page.click('.btn-reconsiderer >> nth=1');
  check(confirms.length === 1 && await page.evaluate(() => DB.agnelles.length) === 3, largeur + ' px : la fiche avec soins, notes et mouvements demande une confirmation ; refus = rien');
  reponse = true;
  await page.click('.btn-reconsiderer >> nth=1');
  check(await page.evaluate(() => DB.agnelles.length) === 2 && await page.evaluate(() => !findLambByEid(E(6, 2)).triStatut), 'accord : la fiche quitte les gardées, l\'agnelle repasse à trier');
  await page.click('#tri-toast-annuler');
  const apres = await page.evaluate(() => ({ fiches: JSON.stringify(DB.agnelles) === window.__fiches, lambs: JSON.stringify([1, 2, 3].map(n => findLambByEid(E(6, n)))) === window.__lambs, ordre: DB.agnelles.map(a => a.id).join() }));
  check(apres.fiches && apres.lambs && apres.ordre === 'a1,a2,a3', largeur + ' px : « Annuler » restaure la fiche EXACTEMENT (soins, notes, mouvements, place) et l\'agneau « gardé » : ' + JSON.stringify(apres));
  // fiche sans saisie : un seul geste, restauration identique
  confirms.length = 0;
  await page.click('.btn-reconsiderer >> nth=0');
  check(confirms.length === 0 && await page.evaluate(() => DB.agnelles.length) === 2, 'fiche sans saisie : aucun confirm');
  await page.click('#tri-toast-annuler');
  check(await page.evaluate(() => JSON.stringify(DB.agnelles) === window.__fiches), 'Annuler : fiche identique');
  await page.context().close();
  console.log('OK ' + largeur + ' px : Garder / Écarter / Reconsidérer / Annuler en un geste, scan = sélection, candidats multiples, vendue absente, sans tableau ni défilement, fiche restaurée exactement.');
}
await browser.close();
