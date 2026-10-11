/* Écran PC « Échographies » (menu de gauche), consultation seule : noyau de calcul COMMUN avec la carte « Dernière échographie » de l'accueil (dernière écho postérieure à la dernière mise bas, à date
   égale la dernière saisie, Vide définitive séparée de Vide, Avortée / pseudogestation à part), filtres (campagne, période, type, lot), « Par lot » (brebis dans deux lots, monte naturelle, lots de recherche
   et de réforme exclus, « Brebis uniques »), échos par semaine ; puis l'écran, l'historique, les exports et l'absence de saisie sur PC. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.EID = eid;
  let compteur = 0;
  const fiche = (id, o) => Object.assign({ id, eid: eid(8, ++compteur), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const e = (date, o) => Object.assign({ date, campagne: 2026 }, o);
  const mb = (date) => [{ date, campagne: 2026, lambs: [{ eid: eid(6, 999), sexe: 'Mâle', sanitaire: [], mouvements: [] }] }];
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; DB.casParticuliers = ['Avortée', 'Pseudogestation'];
  DB.brebis = [
    fiche('P1', { numeroCourtTravailSieol: '8001', echographies: [e('2026-08-01', { type: 'stade', stade: 'Début', agneaux: 'Simple' })] }),
    fiche('P2', { numeroCourtTravailSieol: '8002', echographies: [e('2026-08-01', { type: 'stade', stade: 'Milieu', agneaux: 'Double' })] }),
    fiche('P3', { numeroCourtTravailSieol: '8003', echographies: [e('2026-08-01', { type: 'stade', stade: 'Fin', nombreAgneaux: 3, parasitisme: true })] }),
    fiche('P4', { echographies: [e('2026-08-01', { type: 'stade', stade: 'IA', nombreAgneaux: 4 })] }),
    fiche('P5', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Pleine' })] }),
    fiche('V1', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Vide' })] }),
    fiche('VD', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Vide' })], videesDefinitives: [{ campagne: 2026, date: '2026-10-01' }] }),
    fiche('AV', { echographies: [e('2026-08-01', { type: 'stade', special: 'Avortée' })] }),
    fiche('PS', { echographies: [e('2026-08-01', { type: 'stade', special: 'Pseudogestation' })] }),
    fiche('MB', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Pleine' })], agnelages: mb('2026-09-25') }),
    fiche('MB2', { echographies: [e('2026-08-01', { type: 'stade', stade: 'Milieu', nombreAgneaux: 2 })], agnelages: mb('2026-06-01') }),
    fiche('TIE', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Vide' }), e('2026-08-01', { type: 'stade', stade: 'Fin', agneaux: 'Simple' })] }),
    fiche('T1', { echographies: [e('2026-07-01', { type: 'stade', stade: 'Milieu', agneaux: 'Double' }), e('2026-08-01', { type: 'constat', stade: 'Pleine' })] }),
    fiche('T2', { echographies: [e('2026-07-01', { type: 'constat', stade: 'Pleine' }), e('2026-08-01', { type: 'stade', stade: 'Fin', agneaux: 'Simple' })] }),
    fiche('N'),
    fiche('X', { statut: 'vendue', echographies: [e('2026-08-01', { type: 'constat', stade: 'Pleine' })] })];
  const eids = (...ids) => ids.map(i => DB.brebis.find(s => s.id === i).eid);
  DB.lots = [
    { id: 'IA1', nom: 'IA septembre', type: 'reproduction', mode: 'IA', cible: 'Brebis', campagneMisesBas: 2026, dateEvenement: '2026-07-01', membres: eids('P1', 'P2', 'V1', 'T1') },
    { id: 'EP1', nom: 'Éponge août', type: 'reproduction', mode: 'EP', cible: 'Brebis', campagneMisesBas: 2027, dateEvenement: '2026-08-01', membres: eids('P2', 'P3', 'N') },
    { id: 'REC', nom: 'Recherche écho', type: 'recherche', cible: 'Brebis', membres: eids('P1', 'P4') },
    { id: 'OLD', nom: 'IA ancienne', type: 'reproduction', mode: 'IA', cible: 'Brebis', campagneMisesBas: 2024, dateEvenement: '2023-07-01', membres: eids('P5') }];
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu);
  return page;
}
const pc = await ouvrir(true);
const calc = (F) => pc.evaluate(F => { const d = donneesEchosPc(F); return { R: d.R, parLot: d.parLot.map(g => [g.nom, g.mode, g.brebis, g.pleine, g.vide, g.videDef, g.cas, g.sans, g.pctPleines]), semaines: d.semaines.map(w => [w.num, w.nb]), n: d.lignes.length, nbEchos: d.nbEchos }; }, F);

// ================================================================ 1. noyau commun : le PC sans filtre = la carte de l'accueil
const accueil = await pc.evaluate(() => JSON.stringify(repartitionEchoAccueil()));
const sans = await calc({});
eq(JSON.stringify(sans.R), accueil, 'sans filtre, le PC donne EXACTEMENT les chiffres de la carte de l\'accueil');
eq([sans.R.total, sans.R.pleine, sans.R.vide, sans.R.videDefinitive, sans.R.cas, sans.R.sans], [15, 9, 1, 1, 2, 2], 'répartition : 15 brebis actives (la vendue n\'est pas comptée)');
eq(sans.R.stades, { 'Début': 1, 'Milieu': 2, 'Fin': 3, 'IA': 1, 'Retour 1': 0, 'Retour 2': 0, 'Tardive': 0, nonPrecise: 2 }, 'stades des pleines');
eq(sans.R.comptage, { un: 3, deux: 2, troisEtPlus: 2, sans: 2 }, 'comptage des pleines : 2 = 2 + Double ; 3 et + = 3 + « 4 et plus »');
console.log('OK 1 noyau commun : parité avec l\'accueil, règle écho postérieure à la mise bas, Vide définitive séparée.');

// ================================================================ 2. « Par lot » : monte naturelle, deux lots, brebis dans deux lots, lots de recherche et anciens exclus, Brebis uniques
eq(sans.parLot, [['Monte naturelle', 'Naturelle', 9, 5, 0, 1, 2, 1, 56], ['IA septembre', 'IA', 4, 3, 1, 0, 0, 0, 75], ['Éponge août', 'Éponge', 3, 2, 0, 0, 0, 1, 67]],
  'Par lot : P2 est dans IA septembre ET Éponge août (comptée dans chacun) ; le lot de recherche et le lot de 2024 n\'apparaissent pas');
check(sans.parLot.reduce((n, g) => n + g[2], 0) === 16 && sans.R.total === 15, 'somme des lots (16) > brebis uniques (15) : une brebis dans deux lots');
eq((await calc({ lot: 'mn' })).n, 9, 'filtre Lot « Monte naturelle » : les brebis dans aucun lot de reproduction');
eq((await calc({ lot: 'IA1' })).R.total, 4, 'filtre Lot : les brebis du lot');
eq((await calc({ lot: 'EP1' })).R.total, 3, 'filtre Lot : une brebis qui est aussi dans un autre lot est retenue');
console.log('OK 2 Par lot : monte naturelle, lots IA / Éponge, brebis dans deux lots, Brebis uniques.');

// ================================================================ 3. filtres campagne, période, type : ils restreignent les échos candidates, la population ne change pas
const c2027 = await calc({ campagne: '2027' });
eq([c2027.R.total, c2027.R.pleine, c2027.R.sans, c2027.R.videDefinitive], [15, 0, 15, 0], 'campagne 2027 : aucune écho tagée 2027 -> tout « Sans échographie » (la vide définitive 2026 n\'est pas une vide définitive 2027)');
const c2026 = await calc({ campagne: '2026' });
eq(JSON.stringify(c2026.R), accueil, 'campagne 2026 : toutes les échos sont de 2026, mêmes chiffres');
const apres = await calc({ du: '2026-08-02' });
eq([apres.R.total, apres.R.sans, apres.R.videDefinitive], [15, 14, 1], 'période après le 02/08 : aucune écho candidate ; la vide définitive reste séparée');
const juillet = await calc({ au: '2026-07-31' });
eq([juillet.R.pleine, juillet.R.videDefinitive, juillet.R.sans, juillet.R.stades.Milieu, juillet.R.stades.nonPrecise], [2, 1, 12, 1, 1], 'période jusqu\'au 31/07 : seules les échos de juillet (T1, T2)');
const constat = await calc({ type: 'constat' });
eq([constat.R.pleine, constat.R.vide, constat.R.videDefinitive, constat.R.sans], [3, 2, 1, 9], 'type Constat : seules les échos de constat sont candidates');
const stades = await calc({ type: 'stades' });
eq(stades.R.total, 15, 'type Stades : population inchangée');
console.log('OK 3 filtres campagne, période, type.');

// ================================================================ 4. échos par semaine : semaine ISO, consécutives, jusqu'à la dernière avec échos
eq(sans.semaines, [[27, 2], [28, 0], [29, 0], [30, 0], [31, 15]], 'échos par semaine (S27 à S31)');
eq(sans.nbEchos, 17, 'nombre d\'échos');
eq(await pc.evaluate(() => [lundiSemaineIso('2026-08-01'), numeroSemaineIso('2026-07-27'), lundiSemaineIso('2026-01-01'), numeroSemaineIso(lundiSemaineIso('2026-01-01')), lundiSemaineIso('2027-01-03'), numeroSemaineIso(lundiSemaineIso('2027-01-03'))]),
  ['2026-07-27', 31, '2025-12-29', 1, '2026-12-28', 53], 'semaines ISO (dont le passage d\'année)');
console.log('OK 4 échos par semaine.');

// ================================================================ 5. détail : « Avant mise bas », écho retenue, aucune écriture
const lignes = await pc.evaluate(() => donneesEchosPc({}).lignes.map(r => [r.id, r.cat, r.avantMiseBas, r.echo ? r.echo.date : null]));
eq(lignes.find(l => l[0] === 'MB'), ['MB', 'sans', true, '2026-08-01'], 'MB : a mis bas depuis son écho -> « Sans échographie », écho d\'avant la mise bas conservée pour l\'étiquette');
eq(lignes.find(l => l[0] === 'N'), ['N', 'sans', false, null], 'N : aucune écho');
eq(lignes.find(l => l[0] === 'TIE')[1], 'pleine', 'TIE : à date égale la dernière saisie (stade Fin) l\'emporte sur le constat Vide');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture');
console.log('OK 5 détail : Avant mise bas, date égale, aucune écriture.');
await browser.close();
console.log('\nTOUS LES TESTS DES CALCULS DE L\'ÉCRAN PC ÉCHOGRAPHIES SONT PASSÉS.');
