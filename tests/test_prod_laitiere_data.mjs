/* Refonte Production laitière / Bilan économique, partie 0 : DONNÉES COMMUNES aux écrans et aux exports (fonctions pures). Tank par mois (relevés, litres, moyenne, cumul, mois de
   pointe, tuile « mois en cours » / « dernier mois »), calendrier du tank, qualité par mois (moyennes, Super A, prélèvements « résultats à saisir », résultats positifs),
   économique (mois par mois, totaux, pénalités), formats (milliers, cellules en milliers/mL). Chaque donnée est filtrée sur UNE campagne (frontière 30/09 | 01/10).
   Les totaux doivent égaler les fonctions de calcul EXISTANTES (productionTankCampagne, bilanCampagneQualite). Jeu synthétique ; export réel en LECTURE SEULE. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext()).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.laitTank = [
    { date: '2025-09-30', quantite: 100 }, { date: '2025-10-01', quantite: 200 }, { date: '2025-10-02', quantite: 150.5 }, { date: '2025-12-04', quantite: 300 }, { date: '2025-12-05', quantite: 310 },
    { date: '2026-07-31', quantite: 130 }, { date: '2026-09-30', quantite: 90 }, { date: '2026-10-01', quantite: 500 }];
  const pr = (date, vol, extra) => Object.assign({ id: 'p' + date, date, volumeLait: vol, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: null, salmonelles: null, campagne: campagneAnneeDebutPourDate(date) }, extra);
  DB.prelevementsQualite = [
    pr('2025-09-30', 100, { tb: 60, tp: 50 }),
    pr('2025-10-01', 200),                                                                                                        // créé par la case du Tank : résultats à saisir
    pr('2025-12-05', 310, { tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif' }),
    pr('2026-07-31', 130, { tb: 90, tp: 70, cellules: 300000, floreTotale: 10000, coliformes: 30, butyriques: 50, salmonelles: 'positif' })];
  DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-07-30', dateFin: '2026-07-31', cause: 'salmonelles', litrageL: 1200, commentaire: 'test' }, { id: 'pen0', dateDebut: '2025-09-15', dateFin: '2025-09-15', cause: 'autre', litrageL: 1000 }];
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  window.__avant = JSON.stringify(DB);
});

// ================================================================ 1. tank
const t = await page.evaluate(() => { const d = tankCampagneData(2025); return { total: d.total, pointe: d.pointe, titre: d.titre, dates: [d.dateDebut, d.dateFin], mois: d.mois.map(m => [m.libelle, m.nbReleves, m.litres, m.moyenneReleve, m.cumul]), prod: productionTankCampagne(2025), tuile: d.tuileMois }; });
eq(t.total, { nbReleves: 6, litres: 1180.5, moyenneReleve: 1180.5 / 6, premiereDate: '2025-10-01', derniereDate: '2026-09-30' }, 'total tank campagne 2025 : sans le 30/09/2025 (campagne précédente) ni le 01/10/2026 (suivante)');
check(t.prod === 1180.5 && t.titre === 'Campagne 2026' && t.dates[0] === '2025-10-01' && t.dates[1] === '2026-09-30', 'égal à productionTankCampagne ; libellé et dates : ' + JSON.stringify([t.prod, t.titre, t.dates]));
eq(t.mois.slice(0, 4), [['Octobre 2025', 2, 350.5, 175.25, 350.5], ['Novembre 2025', 0, null, null, null], ['Décembre 2025', 2, 610, 305, 960.5], ['Janvier 2026', 0, null, null, null]], 'mois : relevés, litres, moyenne par relevé, cumul (mois sans lait en tirets)');
eq(t.mois[9], ['Juillet 2026', 1, 130, 130, 1090.5], 'juillet') ; eq(t.mois[11], ['Septembre 2026', 1, 90, 90, 1180.5], 'septembre (cumul = total)');
eq(t.pointe, { libelle: 'Décembre 2025', litres: 610 }, 'mois de pointe');
eq(t.tuile.titre, 'Dernier mois', 'campagne passée (au 03/10/2026) : « Dernier mois »'); eq([t.tuile.libelle, t.tuile.litres], ['Septembre 2026', 90], 'dernier mois de la campagne');
const t2 = await page.evaluate(() => { const d = tankCampagneData(2026); return [d.tuileMois.titre, d.tuileMois.libelle, d.tuileMois.litres, d.tuileMois.nbReleves, d.total.litres]; });
eq(t2, ['Mois en cours', 'Octobre 2026', 500, 1, 500], 'campagne en cours : « Mois en cours » = octobre 2026');
console.log('OK 1 tank : relevés, litres, moyenne, cumul, mois de pointe, tuile mois en cours / dernier mois ; frontière de campagne respectée ; = productionTankCampagne.');

// ================================================================ 2. calendrier
const c = await page.evaluate(() => { const d = calendrierTankData(2025); return { cols: d.colonnes.map(x => x.libelleCourt), oct: d.colonnes[0].jours.slice(0, 4).map(j => [j.jour, j.existe, j.litres]), sep: d.colonnes[3].jours.slice(28, 31).map(j => [j.jour, j.existe, j.litres]), totaux: d.colonnes.map(x => x.total), tot: d.totalLitres, juil31: d.colonnes[2].jours[30] }; });
eq(c.cols, ['Oct 25', 'Déc 25', 'Jul 26', 'Sep 26'], 'colonnes = mois de traite seulement');
eq(c.oct, [[1, true, 200], [2, true, 150.5], [3, true, null], [4, true, null]], 'octobre : litres saisis par jour'); eq(c.sep, [[29, true, null], [30, true, 90], [31, false, null]], 'septembre : le 31 n\'existe pas');
check(c.juil31.existe && c.juil31.litres === 130 && c.tot === 1180.5 && c.totaux.reduce((a, b) => a + b, 0) === 1180.5, 'total par mois et total général : ' + JSON.stringify(c.totaux));
console.log('OK 2 calendrier : 4 colonnes (mois sans lait masqués), jours 1 à 31, jours inexistants, totaux.');

// ================================================================ 3. qualité
const q = await page.evaluate(() => {
  const d = qualiteCampagneData(2025), b = bilanCampagneQualite(2025);
  return { nb: d.total.nbPrelevements, tb: d.total.tb, bTb: b.tb, msu: d.total.msu, bMsu: b.msu, mois: d.mois.map(m => [m.libelle, m.volume, m.nbPrelevements, m.superA]).filter(x => x[2] > 0), cell: d.mois[2].cellules, positifs: d.positifs, sansRes: d.mois[0].prelevements.map(p => prelevementSansResultats(p)), sa: d.total.moisSuperA, av: d.total.moisAvecPrelevements, vol: d.total.volume, parSA: b.superAParMois };
});
check(q.nb === 3 && q.tb === q.bTb && q.msu === q.bMsu && Math.abs(q.tb - (70 * 310 + 90 * 130) / 440) < 1e-9, 'moyennes TB / MSU de la campagne = bilanCampagneQualite, pondérées volume, prélèvement du 30/09/2025 exclu : ' + JSON.stringify([q.nb, q.tb, q.bTb]));
eq(q.mois.map(x => [x[0], x[1], x[2]]), [['Octobre 2025', 350.5, 1], ['Décembre 2025', 610, 1], ['Juillet 2026', 130, 1]], 'prélèvements par mois (volume = tank du mois)');
check(q.cell === 400000 && q.sansRes[0] === true, 'cellules brutes (cellules/mL) conservées ; prélèvement du 01/10 « résultats à saisir »');
eq(q.positifs, [{ date: '2026-07-31', mois: '2026-07', libelleMois: 'Juillet 2026', germe: 'Salmonelles', superAObtenu: false }], 'résultat positif signalé avec son mois et le Super A non obtenu');
check(q.mois.find(x => x[0] === 'Juillet 2026')[3] === false && q.sa === Object.values(q.parSA).filter(Boolean).length - Object.entries(q.parSA).filter(([k, v]) => v && !['2025-10', '2025-12', '2026-07'].includes(k)).length, 'Super A : statut du mois = bilanCampagneQualite.superAParMois (juillet positif → non obtenu)');
console.log('OK 3 qualité : moyennes = bilanCampagneQualite, volume = tank du mois, prélèvement sans résultats détecté, résultat positif signalé, Super A du mois.');

// ================================================================ 4. économique
const e = await page.evaluate(() => {
  const d = ecoCampagneData(2025), b = bilanCampagneQualite(2025);
  const somme = d.mois.reduce((s, m) => s + (m.total || 0), 0);
  return { montantAvec: d.totaux.montantAvec, bAvec: b.montantAvecQualite, hors: d.totaux.montantHors, bHors: b.montantHorsQualite, somme, gain: d.totaux.gain, comp: [d.totaux.grades, d.totaux.superA, d.totaux.penalites], pen: d.penalites.map(p => [p.dateDebut, p.causeLabel, p.litrageL, p.montant]), penMois: d.mois[9].penalitesListe, vis: d.mois.filter(m => m.visible).map(m => m.libelleCourt), prixMoyen: [d.totaux.prixMoyenHors, b.prixMoyenHorsQualite], penCamp: [d.totaux.montantPenalitesCampagne, b.montantPenalitesCampagne] };
});
check(e.montantAvec === e.bAvec && e.hors === e.bHors && Math.abs(e.somme - e.montantAvec) < 1e-6 && e.prixMoyen[0] === e.prixMoyen[1] && e.penCamp[0] === e.penCamp[1], 'totaux = bilanCampagneQualite ; somme des mois = montant avec qualité : ' + JSON.stringify(e));
check(Math.abs(e.gain - (e.comp[0] + e.comp[1] - e.comp[2])) < 1e-6, 'gain = grades + Super A − pénalités : ' + JSON.stringify(e.comp));
eq(e.pen, [['2026-07-30', 'Salmonelles', 1200, 240]], 'pénalités de la campagne uniquement (celle du 15/09/2025 est de la campagne précédente)');
eq(e.penMois.length, 1, 'pénalité rattachée à son mois');
eq(e.vis, ['Oct 25', 'Déc 25', 'Jul 26', 'Sep 26'], 'mois visibles = volume, prélèvement ou pénalité');
console.log('OK 4 économique : totaux et prix moyens = bilanCampagneQualite, somme des mois, gain = grades + Super A − pénalités, pénalités de la campagne.');

// ================================================================ 5. formats
const f = await page.evaluate(() => [fmtGroupe(108178), fmtGroupe(1561.93, 2), fmtGroupe(-240, 2), fmtGroupe(null), fmtCellulesMilliers(414000), fmtCellulesMilliers(null), fmtCellulesMilliers(400000), moisLibelleLong('2026-07')]);
eq(f, ['108 178', '1 561,93', '−240,00', '—', '414', '—', '400', 'Juillet 2026'], 'formats');
console.log('OK 5 formats : milliers insécables, virgule, moins typographique, cellules en milliers/mL.');

// ================================================================ 6. campagnes disponibles, pureté
const camps = await page.evaluate(() => ({ prod: campagnesProductionLaitiere(), tank: campagnesAvecRelevesTank(), mois: moisAvecPrelevements() }));
eq(camps, { prod: [2026, 2025, 2024], tank: [2026, 2025, 2024], mois: ['2025-09', '2025-10', '2025-12', '2026-07'] }, 'campagnes proposées et mois à parcourir');
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture');
console.log('OK 6 campagnes disponibles, mois à parcourir, fonctions pures (DB inchangée).');

// ================================================================ 7. données réelles (lecture seule)
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await page.evaluate((json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB), res = [];
    campagnesProductionLaitiere().forEach(c => {
      const t = tankCampagneData(c), q = qualiteCampagneData(c), e = ecoCampagneData(c), b = bilanCampagneQualite(c);
      const sommeMois = Math.round(t.mois.reduce((s, m) => s + (m.litres || 0), 0) * 10) / 10;
      res.push({ c: c + 1, tank: t.total.litres, prod: productionTankCampagne(c), sommeMois, relevesMois: t.mois.reduce((s, m) => s + m.nbReleves, 0), nbRel: t.total.nbReleves, tb: q.total.tb === b.tb, avec: e.totaux.montantAvec === b.montantAvecQualite, hors: e.totaux.montantHors === b.montantHorsQualite,
        superA: [e.totaux.superA, b.montantSuperA], pen: [e.totaux.penalites, b.montantPenalitesCampagne], gainOk: e.totaux.gain === null || Math.abs(e.totaux.gain - (e.totaux.grades + e.totaux.superA - e.totaux.penalites)) < 1e-6, prelev: q.total.nbPrelevements, cal: calendrierTankData(c).colonnes.length });
    });
    return { res, intact: JSON.stringify(DB) === avant && window.__saves === 0 };
  }, j);
  check(out.intact, 'données réelles : aucune écriture');
  out.res.forEach(r => check(r.tank === r.prod && r.sommeMois === r.tank && r.relevesMois === r.nbRel && r.tb && r.avec && r.hors && r.gainOk, 'réel campagne ' + r.c + ' : ' + JSON.stringify(r)));
  const ecart = out.res.filter(r => r.superA[0] !== r.superA[1] && !(r.superA[0] === null && r.superA[1] === 0));
  console.log('OK 7 données réelles (lecture seule) : ' + JSON.stringify(out.res.map(r => ({ c: r.c, litres: r.tank, relevés: r.nbRel, prélèvements: r.prelev, moisTraite: r.cal, superA: r.superA, pénalités: r.pen }))) + (ecart.length ? ' — ÉCART Super A composition vs bilanCampagneQualite : ' + JSON.stringify(ecart.map(r => [r.c, r.superA])) : ''));
}
await browser.close();
console.log('\nTOUS LES TESTS DES DONNÉES COMMUNES PRODUCTION LAITIÈRE SONT PASSÉS');
