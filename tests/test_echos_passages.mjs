/* Échographies, calculs « Aujourd'hui » (réel à l'instant t, chaque brebis une fois) et « Passages » (un jour d'écho, résultat figé, par lot,
   Repassées / 1re écho, devenir des pleines). Lecture seule, rien n'est ajouté aux échos. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.clock.setFixedTime(new Date('2026-12-03T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);

await p.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const fiche = (n, extra) => Object.assign({ id: 'b' + n, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const E = (date, stade, extra) => Object.assign({ type: 'stades', date, stade, campagne: 2026 }, extra || {});
  DB.brebis = [
    fiche('619001', { echographies: [E('2026-10-15', 'IA', { agneaux: 'Double' })], agnelages: [{ date: '2026-11-02', campagne: 2026, codeRepro: 'IA', lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }] }),   // pleine 15-10 puis mise bas
    fiche('619002', { echographies: [E('2026-10-15', 'IA', { agneaux: 'Simple' })] }),                                    // pleine, à mettre bas
    fiche('619003', { echographies: [E('2026-10-15', 'Vide'), E('2026-11-28', 'Retour 1', { agneaux: 'Simple' })] }),    // vide puis pleine au 2e passage
    fiche('619004', { echographies: [E('2026-10-15', 'Vide'), E('2026-11-28', 'Vide')] }),                               // vide deux fois
    fiche('619005', { echographies: [E('2026-10-15', 'Fin')], statut: 'vendue', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', date: '2026-10-20' }] }),   // pleine puis vendue
    fiche('619006', { echographies: [E('2026-10-15', 'Vide')], videesDefinitives: [{ campagne: 2026, date: '2026-10-16' }] }),   // vide définitive
    fiche('726010', { echographies: [E('2026-11-28', 'Début', { agneaux: 'Double' })] }),                               // antenaise, 1re écho le 28-11
    fiche('619008'),                                                                                                     // jamais passée
    fiche('619009', { statut: 'morte', mouvements: [{ type: 'Morte', date: '2026-10-01' }] }),                           // sortie sans écho : comptée nulle part
    fiche('619010', { echographies: [E('2025-10-10', 'Vide', { campagne: 2025 })] })                                     // écho d'une autre campagne : pas passée en 2026
  ];
  DB.lots = [{ id: 'L1', type: 'reproduction', mode: 'IA', nom: 'Lot IA 1', dateEvenement: '2026-05-20', dateCreation: '2026-05-20', campagneMisesBas: 2026, membres: ['250000045619001', '250000045619002', '250000045619003'] }];
  window.__avant = JSON.stringify(DB);
});

// 1. Aujourd'hui : chaque brebis une fois
const J = await p.evaluate(() => { const d = donneesEchoJour(2026); return { T: d.T, stades: d.stades, comptage: d.comptage, parLot: d.parLot.map(g => [g.nom, g.brebis, g.aMettreBas, g.misBas, g.vide, g.videDef, g.sortie, g.pasPassee]), lignes: d.lignes.map(r => [r.numero, r.sit.cat, r.pastille[0]]) }; });
eq(J.T, { brebis: 9, aMettreBas: 3, misBas: 1, vide: 1, videDef: 1, cas: 0, pasPassee: 2, sortie: 1 }, 'Aujourd\'hui : 9 brebis comptées une fois (la morte sans écho exclue)');
eq([J.stades['IA'], J.stades['Retour 1'], J.stades['Début'], J.comptage], [1, 1, 1, { un: 2, deux: 1, troisEtPlus: 0, sans: 0 }], 'stades et comptage des seules pleines à mettre bas (dernière écho)');
eq(J.parLot, [['Monte naturelle', 6, 1, 0, 1, 1, 1, 2], ['Lot IA 1', 3, 2, 1, 0, 0, 0, 0]], 'par lot, chiffres réels');
check(J.lignes.some(l => l[0] === 'n°19001' && l[2] === 'Mise bas le 02-11-2026') && J.lignes.some(l => l[0] === 'n°19005' && l[2] === 'Vendue le 20-10-2026'), 'pastilles « Mise bas le … » et « Vendue le … » : ' + JSON.stringify(J.lignes));
eq(await p.evaluate(() => donneesEchoJour(2026, 'L1').T.brebis), 3, 'filtre lot');
eq(await p.evaluate(() => brebisAPasserEcho(2026).map(s => numeroVisuel(s.eid)).sort()), ['19004', '19008', '19010'], 'à passer : vides non définitives et jamais passées (présentes)');

// 2. Passages : un par date, le plus récent d'abord, figés
const P = await p.evaluate(() => passagesEchoCampagne(2026).map(x => ({ date: x.date, t: [x.total.passees, x.total.pleines, x.total.vides, x.total.reussite], rep: [x.repassees.passees, x.repassees.pleines, x.repassees.vides], pre: [x.premiere.passees, x.premiere.pleines, x.premiere.antenaises], dev: x.devenir, lots: x.parLot.map(g => [g.nom, g.passees, g.pleines, g.vides, g.reussite]), prec: x.brebis.map(b => [numeroVisuel(b.sheep.eid), libellePrecedenteEcho(b)]) })));
eq(P.map(x => x.date), ['2026-11-28', '2026-10-15'], 'deux passages, le plus récent d\'abord');
eq(P[1].t, [6, 3, 3, 50], '15-10 : 6 passées, 3 pleines, 3 vides, 50 % (la vendue reste comptée)');
eq(P[1].dev, { misBas: 1, restent: 1, sorties: 1 }, '15-10 : devenir des pleines');
eq(P[1].lots, [['Monte naturelle', 3, 1, 2, 33], ['Lot IA 1', 3, 2, 1, 67]], '15-10 : par lot au jour de l\'écho');
eq(P[0].t, [3, 2, 1, 67], '28-11 : 3 passées, 2 pleines, 1 vide');
eq([P[0].rep, P[0].pre], [[2, 1, 1], [1, 1, 1]], '28-11 : repassées (2 → 1 pleine) et 1re écho (antenaise)');
check(P[0].prec.some(x => x[0] === '19003' && x[1] === 'Vide le 15-10-2026') && P[0].prec.some(x => x[0] === '26010' && x[1] === '1re écho · antenaise'), 'écho précédente / 1re écho · antenaise : ' + JSON.stringify(P[0].prec));
eq(await p.evaluate(() => passagesEchoCampagne(2025).map(x => x.date)), ['2025-10-10'], 'campagne 2025 à part');

// 3. lecture seule
check(await p.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'aucune écriture');

await browser.close();
console.log('\nTOUS LES TESTS « ÉCHOGRAPHIES : AUJOURD\'HUI ET PASSAGES » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
