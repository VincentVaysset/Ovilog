/* Tri des agnelles par critères (PC). Moteur : règle « Refuser » = conditions en ET, exceptions RATTACHÉES à la règle (une exception ne lève
   jamais une autre règle), valeur inconnue jamais remplie (sauf « sans … »), règles par campagne, décisions forcées. Noms et n° fictifs. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(() => { DB = migrateData({}); saveData = function () { return true; }; DB.campagneDebut = 2026; DB.campagneInitialisee = true; });

// ---- 1. moteur
const r = await page.evaluate(() => {
  const C = (critere, op, valeur, valeur2) => Object.assign({ critere, op }, valeur !== undefined ? { valeur } : {}, valeur2 !== undefined ? { valeur2 } : {});
  const regles = [
    { id: 'r1', conditions: [C('classe', 'egale', '4')], exceptions: [{ id: 'e1', conditions: [C('lactation', 'auMoins', '300')] }] },
    { id: 'r2', conditions: [C('naissance', 'apres', '2026-11-15')], exceptions: [] }
  ];
  const ag = (classeMere, lactMere, date, origineNaissance, porteeNb) => ({ classeMere, lactMere, date, origineNaissance, porteeNb });
  return {
    exemple: evaluerAgnelleTri(ag(4, 318, '2026-11-19', 'IA', 1), regles),          // classe 4 à 318 L née le 19/11 : refusée (l'exception ne lève pas la règle de date)
    repechee: evaluerAgnelleTri(ag(4, 318, '2026-11-10', 'IA', 1), regles),
    classe4: evaluerAgnelleTri(ag(4, 262, '2026-11-05', 'IA', 1), regles),
    acceptee: evaluerAgnelleTri(ag(1, 412, '2026-11-02', 'IA', 2), regles),
    inconnue: evaluerAgnelleTri(ag(null, null, '2026-11-02', null, null), regles),
    et: evaluerAgnelleTri(ag(3, 250, '2026-11-02', 'MN', 2), [{ id: 'r', conditions: [C('repro', 'egal', 'MN'), C('portee', 'egal', '2')], exceptions: [] }]),
    etNon: evaluerAgnelleTri(ag(3, 250, '2026-11-02', 'MN', 1), [{ id: 'r', conditions: [C('repro', 'egal', 'MN'), C('portee', 'egal', '2')], exceptions: [] }]),
    sans: [conditionTriRemplie(C('classe', 'sans'), ag(null, 1)), conditionTriRemplie(C('lactation', 'sans'), ag(2, null)), conditionTriRemplie(C('repro', 'egal', 'aucun'), ag(2, 1, '', null)), conditionTriRemplie(C('classe', 'sans'), ag(2))],
    entre: [conditionTriRemplie(C('naissance', 'entre', '2026-11-01', '2026-11-10'), ag(1, 1, '2026-11-10')), conditionTriRemplie(C('naissance', 'entre', '2026-11-01', '2026-11-10'), ag(1, 1, '2026-11-11'))],
    triple: [conditionTriRemplie(C('portee', 'egal', '3'), ag(1, 1, '', '', 4)), conditionTriRemplie(C('portee', 'egal', '3'), ag(1, 1, '', '', 2))],
    reproCodes: ['IA', 'EP', 'RE', 'MN'].map(k => conditionTriRemplie(C('repro', 'egal', k), ag(1, 1, '', 'RE', 1))),
    incomplete: [conditionTriComplete(C('lactation', 'moinsDe', '')), conditionTriComplete(C('naissance', 'entre', '2026-11-01')), conditionTriComplete(C('classe', 'egale', '5'))],
    libelles: [libelleConditionsTri(regles[0].conditions), libelleConditionsTri(regles[0].exceptions[0].conditions), libelleConditionsTri([C('naissance', 'entre', '2026-11-01', '2026-11-10'), C('portee', 'egal', '2')])]
  };
});
eq(r.exemple, { refusee: true, motifs: ['Née après le 15-11-2026'], repechages: ['Classe de la mère = 4 · repêchée (Lactation de la mère au moins 300 L)'] }, 'exemple : classe 4 à 318 L née le 19/11 = refusée par la règle de date');
eq([r.repechee.refusee, r.classe4.refusee, r.classe4.motifs, r.acceptee.refusee], [false, true, ['Classe de la mère = 4'], false], 'classe 4 repêchée par sa propre exception, sinon refusée ; classe 1 acceptée');
eq(r.inconnue.refusee, false, 'valeurs inconnues : aucune condition remplie');
eq([r.et.refusee, r.etNon.refusee], [true, false], 'conditions liées par ET');
eq(r.sans, [true, true, true, false], '« sans classe », « sans lactation connue », « sans code »');
eq([r.entre, r.triple, r.reproCodes], [[true, false], [true, false], [false, false, true, false]], 'entre (bornes comprises), triple et plus, 4 codes repro séparés');
eq(r.incomplete, [false, false, false], 'conditions incomplètes jamais remplies');
eq(r.libelles, ['Classe de la mère = 4', 'Lactation de la mère au moins 300 L', 'Née entre le 01-11-2026 et le 10-11-2026 et Portée double'], 'libellés en mots');

// ---- 2. règles par campagne, décisions forcées, sur les agnelles à trier
const d = await page.evaluate(() => {
  DB.brebis = [{ id: 'm1', eid: '250000004510001', statut: 'active', agnelages: [{ id: 'a1', date: '2026-11-02', campagne: 2026, codeRepro: 'IA', lambs: [{ id: 'l1', eid: '250000004571001', sexe: 'Femelle' }, { id: 'l2', eid: '250000004571002', sexe: 'Mâle' }] }], mouvements: [], sanitaire: [] },
    { id: 'm2', eid: '250000004510002', statut: 'active', agnelages: [{ id: 'a2', date: '2026-11-19', campagne: 2026, codeRepro: 'MN', lambs: [{ id: 'l3', eid: '250000004571003', sexe: 'Femelle' }] }], mouvements: [], sanitaire: [] }];
  DB.lactationModele = [{ eid: '250000004510001', campagne: 2025, lactationTotale: 318, classeParQuart: 4 }, { eid: '250000004510002', campagne: 2025, lactationTotale: 410, classeParQuart: 1 }];
  ecrireCriteresTri(2026, { regles: [{ id: 'r1', conditions: [{ critere: 'naissance', op: 'apres', valeur: '2026-11-15' }], exceptions: [] }], decisions: { '250000004571001': 'ecarter' } });
  const t = triCriteresDonnees();
  const autre = criteresTriCampagne(2027);
  return { lignes: t.lignes.map(l => [l.numero, l.refusee, l.proposee, l.decision, l.forcee]), comptes: [t.acceptees, t.refusees, t.forcees], autre: autre.regles.length };
});
eq(d.lignes, [['71001', false, 'garder', 'ecarter', true], ['71003', true, 'ecarter', 'ecarter', false]], 'femelles à trier seulement ; proposition et décision forcée');
eq([d.comptes, d.autre], [[1, 1, 1], 0], 'compteurs ; règles propres à la campagne');
check(!erreurs.length, 'aucune erreur JS ' + erreurs.join(' | '));
console.log('OK 1-2 moteur des critères');
await browser.close();
console.log('test_tri_criteres : OK');
