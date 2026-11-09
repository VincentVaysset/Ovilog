/* Ordre des listes d'animaux : âge (année de l'EID), puis N° COURT croissant (n° de travail SIEOL court, n° de travail du bélier), puis, sans n° court,
   le n° d'ordre (5 derniers chiffres) -- une seule règle (sortByAge = comparerAnimauxAgeNumero). Cas signalé : une agnelle passée brebis (n° court 6100,
   EID en 61xxx) rangée au milieu des 601, 602. Inventaire (écran et exports), liste Brebis, Béliers. Affichage seul : aucun numéro modifié.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const fiche = (n, court, id) => Object.assign({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, court ? { numeroCourtTravailSieol: court } : {});
  // nées en 2016 (chiffre d'année 6) : l'agnelle passée brebis a un EID en 61xxx et le n° court 6100
  DB.brebis = [fiche('661001', '6100', 'a'), fiche('660412', '602', 'b'), fiche('660300', '601', 'c'), fiche('660200', '699', 'd'), fiche('660100', '', 'e'), fiche('650999', '512', 'f')];
  DB.beliers = [{ id: 'r1', eid: '250000045400300', statut: 'actif', numeroTravailSieol: '12', mouvements: [], sanitaire: [], notes: [] }, { id: 'r2', eid: '250000045400100', statut: 'actif', numeroTravailSieol: '7', mouvements: [], sanitaire: [], notes: [] }];
  DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.__avant = JSON.stringify(DB);
});
const ordre = () => p.evaluate(() => sortByAge(DB.brebis).map(s => s.numeroCourtTravailSieol || 'n°' + numeroVisuel(s.eid)));
eq(await ordre(), ['512', '601', '602', '699', '6100', 'n°60100'], 'âge puis n° court croissant (6100 après 699), sans n° court à la fin de son année');
eq(await p.evaluate(() => inventaireActifsItems('brebis').map(s => s.numeroCourtTravailSieol || numeroVisuel(s.eid))), ['512', '601', '602', '699', '6100', '60100'], 'inventaire des brebis (écran et exports)');
eq(await p.evaluate(() => inventaireActifsItems('beliers').map(b => b.numeroTravailSieol)), ['7', '12'], 'béliers : n° de travail croissant');
// même règle que les tableaux du Carnet / des Lots / des Mouvements
eq(await p.evaluate(() => DB.brebis.map(s => ({ s, age: age(s.eid), court: s.numeroCourtTravailSieol || '', numero: numeroVisuel(s.eid) })).sort(comparerAnimauxAgeNumero).map(x => x.court || 'n°' + x.numero)), await ordre(), 'comparerAnimauxAgeNumero = sortByAge');
// liste Brebis (mobile) : cartes dans le même ordre
await p.evaluate(() => render('list')); await p.waitForTimeout(200);
const cartes = await p.evaluate(() => [...document.querySelectorAll('#app .al-ligne')].map(e => e.textContent.replace(/\s+/g, ' ').trim().split(' ')[0]));
check(cartes.length === 6 && cartes.indexOf('6100') > cartes.indexOf('699') && cartes.indexOf('601') < cartes.indexOf('602'), 'liste Brebis : ' + JSON.stringify(cartes));
check(await p.evaluate(() => JSON.stringify(DB) === window.__avant), 'affichage seul : rien n\'est écrit, aucun numéro modifié');
await browser.close();
console.log('OK test_tri_numero_court');
