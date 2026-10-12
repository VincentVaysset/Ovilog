/* Calculs purs du Bilan de reproduction d'une campagne : bilanReproductionCampagne(N).
   1. Jeu SYNTHÉTIQUE qui reproduit exactement le bilan externe du 23/09 (campagne 2026) :
      363 mises bas (296 adultes + 67 antenaises), portées 299 / 64 / 0, 427 nés
      (213 F, 200 M, 14 morts-nés), 38 morts après naissance, prolificité 1,20 / 1,07 /
      1,18, mortalité totale 9,30 % / 26,39 % / 12,18 %.
   2. Courbe hebdomadaire (S1, S2... lundi-dimanche, depuis la première mise bas).
   3. Cas limites : campagne vide, portées 3 et 4+, agneau adopté compté une fois, sexe
      invalide, brebis hors cohorte, brebis du registre, mises bas multiples / sans date.
   4. Recoupement avec le tableau mobile existant ; pureté (DB identique, 0 saveData) ;
      campagne passée stable après une bascule / un archivage ; mouvements.
   5. Export réel (lecture seule, SKIP si absent). Aucune donnée réelle écrite. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent } from './lib/config.mjs';
import { readFileSync } from 'fs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
async function ouvrir(data) {
  const page = await browser.newPage();
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate((data) => {
    DB = migrateData(JSON.parse(JSON.stringify(data || {})));
    window.__saves = 0;
    const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
    window.eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
    window.fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    window.entree = (cause, date) => [{ type: 'Entrée', cause, date }];
    window.poser = (brebis, opts) => {
      DB.campagneDebut = 2025; DB.campagneDateDemarrage = '2025-10-01'; DB.campagneInitialisee = true;
      DB.brebis = brebis; DB.beliers = []; DB.agnelles = []; DB.lots = [];
      DB.registre = (opts && opts.registre) || { brebis: {}, beliers: {}, agnelles: {} };
    };
  }, data);
  return page;
}
const arr2 = v => Math.round(v * 100) / 100;
const pct2 = v => Math.round(v * 10000) / 100;

// ================================================================ 1. bilan du 23/09 reproduit
const page = await ouvrir({});
let r = await page.evaluate(() => {
  const brebis = [];
  // plan par groupe : { n mises bas, doubles, mortNes, femelles, males, mortsF, mortsM, vides }
  const plans = {
    adultes: { n: 296, doubles: 59, mortNes: 8, femelles: 175, males: 172, mortsF: 13, mortsM: 12, vides: 30, chiffres: [3, 4], entree: entree('Achat', '2024-01-01') },
    antenaises: { n: 67, doubles: 5, mortNes: 6, femelles: 38, males: 28, mortsF: 7, mortsM: 6, vides: 8, chiffres: [5], entree: entree('Renouvellement (agnelle devenue brebis)', '2025-10-01') }
  };
  let compteur = 0;
  for (const nom of ['adultes', 'antenaises']) {
    const p = plans[nom];
    const sexes = [].concat(Array(p.mortNes).fill('Mort-né'), Array(p.femelles).fill('Femelle'), Array(p.males).fill('Mâle'));
    let mortsF = p.mortsF, mortsM = p.mortsM;
    const lambs = sexes.map(s => {
      const l = { sexe: s };
      if (s === 'Femelle' && mortsF > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-20' }]; mortsF--; }
      else if (s === 'Mâle' && mortsM > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-21' }]; mortsM--; }
      return l;
    });
    let k = 0;
    for (let i = 0; i < p.n; i++) {
      const nb = i < p.doubles ? 2 : 1;
      const mes = lambs.slice(k, k + nb); k += nb;
      const d = new Date(Date.UTC(2026, 0, 5 + (i % 70))).toISOString().slice(0, 10);
      brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++compteur), { mouvements: p.entree, agnelages: [{ date: d, campagne: 2025, lambs: mes }] }));
    }
    for (let i = 0; i < p.vides; i++) brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++compteur), { mouvements: p.entree }));
    if (k !== lambs.length) throw new Error('jeu de test mal construit');
  }
  poser(brebis);
  return bilanReproductionCampagne(2025);
});
const A = r.groupes.adultes, T = r.groupes.antenaises, TOT = r.groupes.total;
check(r.population.classement.millesimeAntenaise === 2025 && A.presentes === 326 && T.presentes === 75, 'population : 326 adultes + 75 antenaises : ' + JSON.stringify(r.population));
check(A.misesBas === 296 && T.misesBas === 67 && TOT.misesBas === 363 && r.kpis.misesBas === 363, 'mises bas 296 + 67 = 363');
check(JSON.stringify([TOT.portees.simples, TOT.portees.doubles, TOT.portees.triples]) === '[299,64,0]' && JSON.stringify([A.portees.simples, A.portees.doubles]) === '[237,59]' && JSON.stringify([T.portees.simples, T.portees.doubles]) === '[62,5]', 'portées 299 / 64 / 0 (adultes 237/59, antenaises 62/5)');
check(A.nes.total === 355 && T.nes.total === 72 && TOT.nes.total === 427, 'agneaux nés 355 + 72 = 427');
check(TOT.nes.femelles === 213 && TOT.nes.males === 200 && TOT.nes.mortNes === 14 && A.nes.mortNes === 8 && T.nes.mortNes === 6, '213 F, 200 M, 14 morts-nés (8 + 6)');
check(TOT.mortsApres === 38 && A.mortsApres === 25 && T.mortsApres === 13, '38 morts après naissance (25 + 13)');
check(arr2(A.prolificite) === 1.2 && arr2(T.prolificite) === 1.07 && arr2(TOT.prolificite) === 1.18, 'prolificité 1,20 / 1,07 / 1,18 : ' + [A, T, TOT].map(g => arr2(g.prolificite)));
check(pct2(A.mortaliteTotale) === 9.3 && pct2(T.mortaliteTotale) === 26.39 && pct2(TOT.mortaliteTotale) === 12.18, 'mortalité totale 9,30 % / 26,39 % / 12,18 % : ' + [A, T, TOT].map(g => pct2(g.mortaliteTotale)));
check(pct2(TOT.mortinatalite) === 3.28 && pct2(TOT.mortaliteApresNaissance) === 9.2 && pct2(TOT.pctDoubles) === 17.63 && arr2(r.kpis.prolificite) === 1.18, 'mortinatalité 3,28 %, mortalité après naissance 9,20 %, % doubles 17,63 % : ' + [pct2(TOT.mortinatalite), pct2(TOT.mortaliteApresNaissance), pct2(TOT.pctDoubles)]);
check(pct2(A.fertilite) === pct2(296 / 326) && pct2(T.fertilite) === pct2(67 / 75), 'fertilité = mises bas ÷ présentes');
check(r.horsBilan.misesBasHorsCohorte === 0 && r.anomalies.length === 0 && r.periode.titre === 'du 01/10/2025 au 30/09/2026', 'aucun hors bilan, aucune anomalie, titre « ' + r.periode.titre + ' »');
console.log('OK 1 bilan du 23/09 reproduit : 363 mises bas (296 + 67), portées 299/64/0, 427 nés (213 F / 200 M / 14 MN), 38 morts, prolificité 1,20 / 1,07 / 1,18, mortalité 9,30 / 26,39 / 12,18 %.');

// ---- recoupement avec le tableau mobile + pureté
const rec = await page.evaluate(() => {
  const avant = JSON.stringify(DB); window.__saves = 0;
  const cohort = campagneCohortPresente();
  const [a, b] = statsDetailleesParGroupeAge(cohort, classementAntenaisesCampagne(cohort));
  const n = bilanReproductionCampagne(2025);
  return { a, b, n: n.groupes, intact: JSON.stringify(DB) === avant, saves: window.__saves, mill: n.parMillesime.reduce((t, l) => t + l.presentes, 0), cohort: cohort.length };
});
const cmp = (m, g) => m.presentes === g.presentes && m.misesBas === g.misesBas && m.males === g.nes.males && m.femelles === g.nes.femelles && m.mortNes === g.nes.mortNes && m.nesTotal === g.nes.total && m.morts === g.nes.mortNes + g.mortsApres;
check(cmp(rec.b, rec.n.adultes) && cmp(rec.a, rec.n.antenaises), 'recoupement tableau mobile (statsDetailleesParGroupeAge) : mêmes groupes');
check(rec.intact && rec.saves === 0 && rec.mill === rec.cohort, 'pureté : DB identique, 0 saveData ; détail par millésime = population');
console.log('OK 1b recoupement avec le tableau mobile existant (adultes / antenaises identiques) ; pureté (DB intacte, 0 saveData).');

// ================================================================ 2. courbe hebdomadaire
r = await page.evaluate(() => {
  const mb = (d, n) => ({ date: d, campagne: 2025, lambs: Array(n).fill(0).map(() => ({ sexe: 'Mâle' })) });
  poser([
    fiche(eid(3, 1), { agnelages: [mb('2026-01-07', 1)] }),   // mercredi -> semaine du lundi 05/01
    fiche(eid(3, 2), { agnelages: [mb('2026-01-11', 2)] }),   // dimanche -> même semaine
    fiche(eid(3, 3), { agnelages: [mb('2026-01-12', 1)] }),   // lundi -> semaine suivante
    fiche(eid(3, 4), { agnelages: [mb('2026-01-27', 3)] }),   // mardi -> semaine du lundi 26/01
    fiche(eid(3, 5), { agnelages: [{ date: null, campagne: 2025, lambs: [{ sexe: 'Femelle' }] }] }),
    fiche(eid(3, 6), { agnelages: [mb('2027-05-05', 1)] })
  ]);
  return bilanReproductionCampagne(2025);
});
const sem = r.semaines;
check(sem.length === 4 && sem.map(w => w.semaine).join() === 'S1,S2,S3,S4' && sem.map(w => w.debut).join() === '2026-01-05,2026-01-12,2026-01-19,2026-01-26', 'semaines S1..S4 (lundis 05/01, 12/01, 19/01, 26/01) : ' + JSON.stringify(sem.map(w => [w.semaine, w.debut])));
check(sem.map(w => w.misesBas).join() === '2,1,0,1' && sem.map(w => w.agneaux).join() === '3,1,0,3' && sem.map(w => w.cumulMisesBas).join() === '2,3,3,4' && sem.map(w => w.cumulAgneaux).join() === '3,4,4,7', 'mises bas 2,1,0,1 ; agneaux 3,1,0,3 ; cumuls 2,3,3,4 / 3,4,4,7 : ' + JSON.stringify(sem));
check(r.groupes.total.misesBas === 6 && r.groupes.total.nes.total === 9, 'sans date et hors période : comptées dans les totaux (6 mises bas, 9 nés)');
const codes = r.anomalies.map(a => a.code);
check(codes.includes('mise-bas-sans-date') && codes.includes('mise-bas-date-hors-periode'), 'signalées en anomalies, absentes de la courbe : ' + codes);
console.log('OK 2 courbe hebdomadaire : S1..S4 lundi-dimanche (dimanche dans la semaine, lundi dans la suivante), semaine vide S3, cumuls ; sans date / hors période signalées et hors courbe.');

// ================================================================ 3. cas limites
r = await page.evaluate(() => { poser([]); return bilanReproductionCampagne(2025); });
check(r.groupes.total.misesBas === 0 && r.groupes.total.prolificite === null && r.groupes.total.fertilite === null && r.groupes.total.mortaliteTotale === null && r.semaines.length === 0 && r.population.presentes === 0, 'campagne vide : zéro partout, ratios null (jamais 0), pas d\'erreur');
r = await page.evaluate(() => {
  poser([
    fiche(eid(3, 1), { agnelages: [{ date: '2026-01-10', campagne: 2025, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }, { sexe: 'Mâle' }] }] }),                     // triple
    fiche(eid(3, 2), { agnelages: [{ date: '2026-01-10', campagne: 2025, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }, { sexe: 'Mâle' }, { sexe: 'Mort-né' }, { sexe: 'Mort-né' }] }] }), // 4+
    fiche(eid(3, 3), { agnelages: [{ date: '2026-01-11', campagne: 2025, lambs: [{ sexe: 'Mâle', adopte: true, adoptiveEid: eid(3, 4) }] }] }),                    // adopté (reste chez la mère biologique)
    fiche(eid(3, 4), {}),                                                                                                                                        // mère adoptive : aucune mise bas
    fiche(eid(3, 5), { agnelages: [{ date: '2026-01-12', campagne: 2025, lambs: [{ sexe: undefined }] }] }),                                                      // sexe invalide
    fiche(eid(3, 6), { agnelages: [{ date: '2026-01-13', campagne: 2025, lambs: [] }] }),                                                                         // sans agneau
    fiche(eid(3, 7), { agnelages: [{ date: '2026-01-14', campagne: 2025, lambs: [{ sexe: 'Mâle' }] }, { date: '2026-02-14', campagne: 2025, lambs: [{ sexe: 'Femelle' }] }] }), // mises bas multiples
    fiche(eid(3, 8), { agnelages: [{ date: '2025-01-14', campagne: 2024, lambs: [{ sexe: 'Mâle' }] }] }),                                                         // autre campagne : ignorée
    fiche(eid(3, 9), { mouvements: entree('Achat', '2025-12-01'), agnelages: [{ date: '2026-03-01', campagne: 2025, lambs: [{ sexe: 'Femelle' }, { sexe: 'Femelle' }] }] }) // hors cohorte (entrée après le démarrage)
  ], { registre: { brebis: {
    [eid(3, 10)]: { eid: eid(3, 10), mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', date: '2026-04-01' }], agnelages: [{ date: '2026-01-20', campagne: 2025, lambs: [{ sexe: 'Mâle' }] }] }   // brebis du registre (fiche retirée), vendue après le démarrage
  }, beliers: {}, agnelles: {} } });
  return bilanReproductionCampagne(2025);
});
const g = r.groupes.total; // toutes du même millésime -> toutes antenaises : on lit le total
check(g.portees.simples === 4 && g.portees.doubles === 1 && g.portees.triples === 1 && g.portees.quatreEtPlus === 1 && g.sansAgneau === 1, 'portées : 3 -> triple, 5 -> 4 et plus, 0 -> sans agneau : ' + JSON.stringify(g.portees) + ' sansAgneau=' + g.sansAgneau);
check(g.misesBas === 8 && g.misesBasCohorte === 7 && r.horsBilan.misesBasHorsCohorte === 1 && r.horsBilan.brebisAvecMiseBasHorsCohorte === 1 && r.horsBilan.entreesTardives === 1, 'hors cohorte : incluse dans les mises bas (8), exclue de la fertilité (7 sur ' + g.presentes + ' présentes), compteur hors bilan : ' + JSON.stringify(r.horsBilan));
check(g.presentes === 9, 'population : 8 fiches (dont la mère adoptive) + la brebis du registre, sans la brebis entrée tard = 9 : ' + g.presentes);
check(g.nes.total === 3 + 5 + 1 + 1 + 0 + 1 + 2 + 1 && g.nes.sexeInvalide === 1, 'agneaux : l\'adopté est compté UNE fois (chez sa mère biologique), le sexe invalide est compté parmi les nés : ' + JSON.stringify(g.nes));
const cd = r.anomalies.map(a => a.code).sort();
check(['agneau-sexe-invalide', 'mise-bas-hors-cohorte', 'mise-bas-sans-agneau', 'mises-bas-multiples'].every(c => cd.includes(c)), 'anomalies remontées sans correction : ' + cd);
check(r.groupes.total.misesBas === 8 && !r.anomalies.some(a => a.code === 'mises-bas-multiples' && a.nombre !== 1), 'mises bas multiples : seule la première est comptée, signalée une fois');
console.log('OK 3 cas limites : campagne vide (ratios null), triple / 4+ / sans agneau, adopté compté une fois, sexe invalide signalé, hors cohorte incluse dans les totaux et hors fertilité (compteur hors bilan), brebis du registre comptée, mises bas multiples signalées.');

// ================================================================ 4. campagne passée stable
r = await page.evaluate(() => {
  const base = () => [
    fiche(eid(3, 1), { agnelages: [{ date: '2026-01-10', campagne: 2025, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }] }),
    fiche(eid(5, 2), { mouvements: entree('Renouvellement (agnelle devenue brebis)', '2025-10-01'), agnelages: [{ date: '2026-02-10', campagne: 2025, lambs: [{ sexe: 'Mort-né' }] }] }),
    fiche(eid(3, 3), { statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', date: '2026-04-01' }], agnelages: [{ date: '2026-01-20', campagne: 2025, lambs: [{ sexe: 'Femelle' }] }] })
  ];
  poser(base());
  const avant = bilanReproductionCampagne(2025);
  // bascule simulée : campagne suivante, la brebis vendue est archivée dans le registre puis retirée
  const vendue = DB.brebis.find(s => s.eid === eid(3, 3));
  DB.registre.brebis[vendue.eid] = { eid: vendue.eid, mouvements: vendue.mouvements, agnelages: vendue.agnelages };
  DB.brebis = DB.brebis.filter(s => s.eid !== vendue.eid);
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29';
  const apres = bilanReproductionCampagne(2025);
  const cle = x => JSON.stringify({ g: x.groupes, k: x.kpis, s: x.semaines, m: x.mouvements, p: x.population.presentes });
  return { memes: cle(avant) === cle(apres), avantCourante: avant.courante, apresCourante: apres.courante, tot: apres.groupes.total.misesBas, pres: apres.population.presentes, suivante: bilanReproductionCampagne(2026).groupes.total.misesBas };
});
check(r.memes && r.tot === 3 && r.pres === 3 && r.avantCourante && !r.apresCourante && r.suivante === 0, 'campagne passée inchangée après bascule + archivage au registre : ' + JSON.stringify(r));
console.log('OK 4 campagne passée : mêmes chiffres avant et après bascule / archivage d\'une brebis vendue au registre ; la campagne suivante repart à 0.');

// ================================================================ 5. mouvements
r = await page.evaluate(() => {
  const mvAgn = [{ type: 'Entrée', cause: 'Naissance', date: '2026-02-10' }, { type: 'Vente', cause: null, date: '2026-06-01' }];
  poser([
    fiche(eid(3, 1), { mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2025-11-10' }, { type: 'Vente', date: '2026-03-01' }, { type: 'Morte', date: '2025-09-15' }] }),   // adulte : achat + vente dans la fenêtre, mort avant (ignorée)
    fiche(eid(5, 2), { mouvements: [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2025-10-01' }, { type: 'Vente reproduction', date: '2026-05-05' }, { type: 'Perte', date: '2026-06-06' }] }),
    fiche(eid(3, 3), { mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Autoconsommation', date: '2026-07-07' }, { type: 'Mort', date: '2026-08-08' }] }),
    fiche(eid(5, 4), { mouvements: [{ type: 'Entrée', date: '2024-01-01' }] }),
    fiche(eid(3, 5), { agnelages: [{ date: '2026-01-10', campagne: 2025, lambs: [
      { sexe: 'Femelle', triStatut: 'gardée' }, { sexe: 'Femelle', statutFinal: 'vendu', mouvements: [{ type: 'Vendu', date: '2026-04-04' }] },
      { sexe: 'Mâle', statutFinal: 'mort', mouvements: [{ type: 'Mort', date: '2026-01-20' }] }, { sexe: 'Mâle' }, { sexe: 'Mort-né' }] }] }),
    fiche(eid(5, 6), { agnelages: [{ date: '2026-02-10', campagne: 2025, lambs: [{ sexe: 'Femelle' }, { sexe: 'Mâle', statutFinal: 'vendu' }] }] })
  ], { registre: { brebis: {}, beliers: {}, agnelles: { [eid(6, 20)]: { eid: eid(6, 20), mouvements: mvAgn.concat(mvAgn) } } } });   // registre agnelle : chaque mouvement en double
  DB.agnelles = [{ id: 'a9', eid: eid(6, 21), motherEid: null, pere: '', mere: '', sanitaire: [], modesRepro: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-03-03' }] }];
  return bilanReproductionCampagne(2025);
});
const mb = r.mouvements.brebis;
check(mb.adultes.entrees.achat === 1 && mb.adultes.entrees.total === 1 && mb.adultes.sorties.ventes === 1 && mb.adultes.sorties.autoconsommation === 1 && mb.adultes.sorties.mortes === 1 && mb.adultes.sorties.total === 3, 'brebis adultes : 1 achat, 1 vente, 1 autoconsommation, 1 morte (la mort du 15/09/2025 est avant la campagne, ignorée) : ' + JSON.stringify(mb.adultes));
check(mb.antenaises.entrees.renouvellement === 1 && mb.antenaises.sorties.ventesReproduction === 1 && mb.antenaises.sorties.pertes === 1 && mb.total.entrees.total === 2 && mb.total.sorties.total === 5, 'antenaises : 1 renouvellement, 1 vente reproduction, 1 perte ; total 2 entrées / 5 sorties : ' + JSON.stringify(mb.antenaises));
check(r.mouvements.agnelles.entrees.naissance === 1 && r.mouvements.agnelles.entrees.achat === 1 && r.mouvements.agnelles.sorties.ventes === 1, 'agnelles : 1 naissance, 1 achat, 1 vente — les mouvements en double du registre sont comptés UNE fois : ' + JSON.stringify(r.mouvements.agnelles));
const dup = r.anomalies.find(a => a.code === 'mouvements-doublons-registre');
check(dup && dup.nombre === 2, 'doublons du registre signalés (2) sans modifier les données');
const ag = r.mouvements.agneaux;
check(ag.adultes.femelles.nes === 2 && ag.adultes.femelles.gardes === 1 && ag.adultes.femelles.vendus === 1 && ag.adultes.males.nes === 2 && ag.adultes.males.morts === 1 && ag.adultes.males.presents === 1 && ag.adultes.mortNes === 1, 'agneaux des adultes : 2 F (1 gardée, 1 vendue), 2 M (1 mort, 1 présent), 1 mort-né : ' + JSON.stringify(ag.adultes));
check(ag.antenaises.femelles.nes === 1 && ag.antenaises.femelles.presents === 1 && ag.antenaises.males.nes === 1 && ag.antenaises.males.vendus === 1, 'agneaux des antenaises : 1 F présente, 1 M vendu : ' + JSON.stringify(ag.antenaises));
console.log('OK 5 mouvements : brebis adultes / antenaises (entrées, sorties par type, fenêtre de la campagne), agnelles, doublons du registre comptés une fois et signalés, agneaux par groupe et par sexe (gardées, vendus, morts, présents).');
await page.close();

// ================================================================ 6. export réel (lecture seule)
if (!exportPresent(EXPORT_CORRIGE)) console.log('SKIP : export corrigé absent');
else {
  const data = JSON.parse(readFileSync(EXPORT_CORRIGE, 'utf8'));
  const p = await ouvrir(data);
  const x = await p.evaluate(() => {
    const avant = JSON.stringify(DB); window.__saves = 0;
    const n = bilanReproductionCampagne(DB.campagneDebut);
    const cohort = campagneCohortPresente();
    const [a, b] = statsDetailleesParGroupeAge(cohort, classementAntenaisesCampagne(cohort));
    return { n, a: a.presentes, b: b.presentes, intact: JSON.stringify(DB) === avant, saves: window.__saves, passee: bilanReproductionCampagne(DB.campagneDebut - 1).groupes.total.misesBas };
  });
  check(x.n.population.presentes === 428 && x.n.groupes.antenaises.presentes === 115 && x.n.groupes.adultes.presentes === 313 && x.a === 115 && x.b === 313, 'export : 115 antenaises / 313 adultes / 428 présentes, identique au tableau mobile : ' + JSON.stringify([x.n.groupes.antenaises.presentes, x.n.groupes.adultes.presentes]));
  check(x.n.groupes.total.misesBas === 0 && x.n.groupes.total.prolificite === null && x.n.semaines.length === 0 && x.passee === 0, 'export : aucune mise bas dans les données (les mises bas 2026 ont été remises à zéro) : ratios null, pas d\'erreur');
  check(x.n.mouvements.brebis.antenaises.entrees.renouvellement === 115 && x.n.periode.debutReel === '2026-09-29', 'export : 115 entrées « Renouvellement » dans la campagne, fenêtre depuis la vraie date de bascule 29/09');
  const d = x.n.anomalies.find(a => a.code === 'mouvements-doublons-registre');
  check(d && d.nombre === 230, 'export : les 230 mouvements en double du registre agnelles sont signalés (et pas comptés deux fois)');
  check(x.intact && x.saves === 0, 'export : DB identique, 0 saveData');
  console.log('OK 6 export du 29/09 (lecture seule) : 115 antenaises / 313 adultes = tableau mobile ; 115 renouvellements ; 230 doublons du registre signalés, non comptés ; aucune mise bas -> ratios null ; DB intacte.');
  await p.close();
}
console.log('\nTOUS LES TESTS DES CALCULS DU BILAN SONT PASSÉS (jeux synthétiques ; export réel en lecture seule si présent)');
await browser.close();
process.exit(0);
