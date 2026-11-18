/* Présentes à la mise bas (PMB) : UNE règle pour les lots IA / éponge et le bilan de la campagne, sans écho.
   - Lot : début des mises bas = date du lot + G min (bornes réglées), TOUJOURS (une mise bas précoce ou un avortement ne le déplacent pas) ;
   - Campagne : chaque brebis une fois ; début = celui de SON lot visant la campagne (plusieurs lots : celui de sa mise bas, sinon le plus
     récent) ; sans lot, 1re mise bas réelle des brebis SANS lot de son groupe (antenaises / adultes, agnelles luttées à part = plus tard) ;
   - sortie (morte, vendue, inventaire) AVANT ce début, sans mise bas = HORS EFFECTIF ; présente au début puis sortie sans mise bas = échec ;
   - aucune mise bas encore dans le groupe : toute sortie est hors effectif ; l'écho ne compte jamais ; une sortie « Mise à jour inventaire »
     d'avant le démarrage n'est pas présente. Exemple de l'éleveur : 2 antenaises mortes en novembre, mises bas en décembre -> hors effectif.
   Jeu SYNTHÉTIQUE (indicatif 000456), aucune donnée réelle ; saveData REMPLACÉ, lecture seule. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.clock.setFixedTime(new Date('2027-01-15T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);

// ---------- 1. Lots ----------
const stats = (cas, mode) => p.evaluate(({ cas, mode }) => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const lot = { id: 'L1', type: 'reproduction', mode, nom: 'Lot test', dateEvenement: '2026-06-01', dateCreation: '2026-06-01', campagneMisesBas: 2026, membres: [] };
  DB.lots = [lot];
  DB.brebis = cas.map((c, i) => {
    const eid = '250000045' + String(600000 + i);
    lot.membres.push(eid);
    const b = { id: 'b' + i, eid, statut: 'active', createdAt: 1, echographies: [{ type: 'stades', date: '2026-07-10', stade: 'IA', campagne: 2026 }], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] };
    const sortie = (type, d) => { b.statut = type === 'Vente' ? 'vendue' : 'morte'; b.mouvements.push({ type, date: d }); };
    if (c === 'mb') b.agnelages.push({ date: '2026-10-25', campagne: 2026, codeRepro: mode, lambs: [{ sexe: 'Mâle', eid: '' }, { sexe: 'Femelle', eid: '' }] });
    if (c === 'mbRetour') b.agnelages.push({ date: '2026-11-12', campagne: 2026, codeRepro: 'RE', lambs: [{ sexe: 'Mâle', eid: '' }] });
    if (c === 'morteAvant') sortie('Morte', '2026-09-15');           // pleine à l'écho, morte avant le début : hors effectif
    if (c === 'vendueApres') sortie('Vente', '2026-11-30');          // présente au début des mises bas : échec
    return b;
  });
  const s = mode === 'IA' ? statsLotIA(lot) : statsLotEponge(lot);
  const age = mode === 'IA' ? statsLotIAParAgeExact(lot) : statsLotEpongeParAgeExact(lot);
  const resume = resumeLotParGroupeAge(lot, age);
  return { debut: debutMisesBasLot(lot), s, libelle: libelleSortiesAvantMiseBasLot(s.sortiesDetail), resume: resume.map(g => [g.effectif, g.fertilite]).filter(g => g[0] > 0) };
}, { cas, mode });
const n = (k, v) => Array(k).fill(v);

let r = await stats([...n(6, 'mb'), 'mbRetour', ...n(2, 'morteAvant'), 'vendueApres'], 'IA');
eq(r.debut, '2026-10-23', 'lutte du 1er juin + G min (144 j) = début des mises bas le 23/10');
eq([r.s.effectif, r.s.sorties, r.s.ia.misesBas, r.s.ia.fertilite, r.s.retour.misesBas, r.s.global.fertilite, r.s.global.prolificite], [8, 2, 6, 75, 1, 87.5, 1.86], 'IA : mortes avant le début hors effectif (pleines ou non), vendue après = échec');
eq(r.libelle, '2 sorties avant le début des mises bas (23/10) : hors effectif', 'ligne grise des lots');
eq(r.resume, [[8, 87.5]], 'résumé par groupe d\'âge : même effectif');
r = await stats([...n(3, 'mb'), 'morteAvant', 'vendueApres'], 'EP');
eq([r.s.effectif, r.s.sorties, r.s.misesBas, r.s.fertilite], [4, 1, 3, 75], 'éponge : même règle');
// une mise bas anormale (précoce) ou un avortement ne déplacent jamais le début du lot
const tot = await p.evaluate(() => { DB.brebis[0].agnelages[0].date = '2026-09-10'; const a = debutMisesBasLot(DB.lots[0]); DB.brebis[0].agnelages[0].avortement = true; return [a, debutMisesBasLot(DB.lots[0])]; });
eq(tot, ['2026-10-23', '2026-10-23'], 'début du lot = date + G min, toujours');

// ---------- 2. Bilan de la campagne ----------
const c = await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const mk = (n, an, extra) => Object.assign({ id: 'b' + n, eid: '2500000456' + an + String(n).padStart(4, '0'), statut: 'active', createdAt: 1,
    mouvements: [{ type: 'Entrée', date: '2025-06-01', cause: 'Renouvellement' }], echographies: [], agnelages: [], sanitaire: [], notes: [], modesRepro: [], controleLaitier: [] }, extra || {});
  const sortie = (d, type) => ({ statut: 'sortie', mouvements: [{ type: 'Entrée', date: '2025-06-01', cause: 'Renouvellement' }, { type: type || 'Morte', date: d }] });
  const mb = (d, n) => ({ agnelages: [{ date: d, campagne: 2026, codeRepro: 'MN', lambs: Array.from({ length: n }, () => ({ sexe: 'Femelle', eid: '' })) }] });
  DB.brebis = [
    // antenaises (2025), luttées à part : 1re mise bas le 15/12
    mk(1, 5, mb('2026-12-15', 2)), mk(2, 5),
    mk(3, 5, Object.assign(sortie('2026-11-10'), { echographies: [{ date: '2026-10-01', campagne: 2026, stade: 'IA' }] })),   // morte pleine en novembre : hors effectif
    mk(4, 5, sortie('2026-11-12')),                                                                   // morte en novembre : hors effectif
    // adultes (2020) : 1re mise bas le 20/10
    mk(5, 0, mb('2026-10-20', 1)), mk(6, 0, mb('2026-10-28', 2)),
    mk(7, 0, sortie('2026-10-01', 'Vente')),               // vendue avant le 20/10 : hors effectif
    mk(8, 0, sortie('2026-11-05')),                        // morte après le début, sans mise bas : échec
    mk(9, 0, sortie('2026-08-01', SORTIE_INVENTAIRE))      // sortie inventaire avant le démarrage : pas présente
  ];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const b = bilanReproductionCampagne(2026);
  const cohort = campagneCohortPresente();
  const relu = bilanDepuisResume(construireResumeCampagne(2026, { type: 'test', libelle: 'test' }, b));
  return {
    ant: [b.groupes.antenaises.presentes, b.groupes.antenaises.misesBas, Math.round(b.groupes.antenaises.fertilite * 1000) / 10],
    adu: [b.groupes.adultes.presentes, b.groupes.adultes.misesBas, Math.round(b.groupes.adultes.fertilite * 1000) / 10, b.groupes.adultes.prolificite],
    ligne: libelleSortiesAvantMiseBasCampagne(b.sortiesAvantMiseBas),
    cohort: cohort.map(s => s.id).sort(),
    mob: statsDetailleesParGroupeAge(cohort).map(g => [g.label, g.presentes, g.pctMisesBas]),
    mil: statsParAgeExactTroupeau(cohort, null, 2026).map(m => [m.millesime, m.presentes, m.fertilite]),
    resume: relu.groupes.total.fertilite === b.groupes.total.fertilite
  };
});
eq(c.ant, [2, 1, 50], 'antenaises : les 2 mortes en novembre (mises bas en décembre) hors effectif, écho ou pas');
eq(c.adu, [3, 2, 66.7, 1.5], 'adultes : vendue avant le 20/10 hors effectif, morte après = échec, inventaire d\'avant pas présente');
eq(c.ligne, 'Sorties avant le début des mises bas, hors effectif : 2 antenaises, 1 adulte', 'ligne grise du bilan');
eq(c.cohort, ['b1', 'b2', 'b5', 'b6', 'b8'], 'population commune (écran mobile, taux de réussite)');
eq(c.mob, [['Antenaises', 2, 50], ['Brebis', 3, 66.7]], 'groupes mobiles : mêmes chiffres');
eq(c.mil, [[2020, 3, 66.7], [2025, 2, 50]], 'détail par millésime : mêmes chiffres');
eq(c.resume, true, 'résumé de fin de campagne : même fertilité');

// brebis d'un lot IA : son début est celui de son lot (date + G min), pas la 1re mise bas des brebis sans lot ; ré-épongée : lot de sa mise bas, sinon le plus récent
const lot = await p.evaluate(() => {
  const b7 = DB.brebis.find(s => s.id === 'b7');                       // vendue le 01/10 : hors effectif sans lot (adultes sans lot : début 20/10)
  DB.lots = [{ id: 'LIA', type: 'reproduction', mode: 'IA', dateEvenement: '2026-04-15', dateCreation: '2026-04-15', campagneMisesBas: 2026, membres: [b7.eid] }];   // début 06/09
  const avec = campagneCohortPresente().some(s => s.id === 'b7');
  const b8 = DB.brebis.find(s => s.id === 'b8');                       // morte le 05/11
  DB.lots.push({ id: 'LIA2', type: 'reproduction', mode: 'IA', dateEvenement: '2026-03-01', dateCreation: '2026-03-01', campagneMisesBas: 2026, membres: [b8.eid] },
    { id: 'LEP', type: 'reproduction', mode: 'EP', dateEvenement: '2026-07-01', dateCreation: '2026-07-01', campagneMisesBas: 2026, membres: [b8.eid] });   // ré-épongée : début 22/11
  return [avec, lotReproBrebisCampagne(b8, 2026).id, campagneCohortPresente().some(s => s.id === 'b8')];
});
eq(lot, [true, 'LEP', false], 'lot IA : vendue après le début de son lot = échec ; ré-épongée : le lot le plus récent, morte avant son début = hors effectif');
await p.evaluate(() => { DB.lots = []; });

// aucune mise bas encore : toute sortie hors effectif
const vide = await p.evaluate(() => { DB.brebis.forEach(s => { s.agnelages = []; }); return bilanReproductionCampagne(2026).groupes.total.presentes; });
eq(vide, 4, 'avant toute mise bas : présentes = brebis encore là');

await browser.close();
console.log('OK test_presentes_mise_bas');
