/* Bilan des lots IA / éponge : une brebis SORTIE avant sa mise bas (vente, mort, inventaire) est jugée sur sa dernière écho de la campagne du lot
   (issueSortieAvantMiseBasLot) : vide = échec dans le taux ; pleine stade IA = réussite (fertilité, jamais prolificité) ; pleine Retour = réussite du
   retour ; aucune écho = hors taux, comptée à part. Exemple de l'éleveur : 100 à l'IA, 50 pleines, 50 vides vendues -> 50 %, jamais 100 %.
   Jeu synthétique (indicatif 000456), aucune donnée réelle ; saveData REMPLACÉ, lecture seule. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);

// cas : liste de { issue: 'mb' | 'mbRetour' | 'videVendue' | 'pleineMorte' | 'retourMorte' | 'sansEchoVendue' | 'videPresente' }
const stats = (cas, mode) => p.evaluate(({ cas, mode }) => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const lot = { id: 'L1', type: 'reproduction', mode, nom: 'Lot test', dateEvenement: '2026-05-20', dateCreation: '2026-05-20', campagneMisesBas: 2026, membres: [] };
  DB.lots = [lot];
  DB.brebis = cas.map((c, i) => {
    const eid = '250000045' + String(600000 + i);
    lot.membres.push(eid);
    const b = { id: 'b' + i, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] };
    const echo = stade => b.echographies.push({ type: 'stades', date: '2026-07-10', stade, campagne: 2026 });
    const sortie = type => { b.statut = type === 'Vente' ? 'vendue' : 'morte'; b.mouvements.push({ type, date: '2026-08-01' }); };
    if (c === 'mb') { echo('IA'); b.agnelages.push({ date: '2026-10-15', campagne: 2026, codeRepro: mode, lambs: [{ sexe: 'Mâle', eid: '' }, { sexe: 'Femelle', eid: '' }] }); }
    if (c === 'mbRetour') { echo('Retour 1'); b.agnelages.push({ date: '2026-11-05', campagne: 2026, codeRepro: 'RE', lambs: [{ sexe: 'Mâle', eid: '' }] }); }
    if (c === 'videVendue') { echo('Vide'); sortie('Vente'); }
    if (c === 'pleineMorte') { echo('IA'); sortie('Morte'); }
    if (c === 'retourMorte') { echo('Retour 1'); sortie('Morte'); }
    if (c === 'sansEchoVendue') sortie('Vente');
    if (c === 'videPresente') echo('Vide');
    return b;
  });
  const s = mode === 'IA' ? statsLotIA(lot) : statsLotEponge(lot);
  const age = mode === 'IA' ? statsLotIAParAgeExact(lot) : statsLotEpongeParAgeExact(lot);
  const resume = resumeLotParGroupeAge(lot, age);
  return { s, libelle: libelleSortiesAvantMiseBasLot(s.sortiesDetail), resume: resume.map(g => [g.effectif, g.fertilite]).filter(g => g[0] > 0) };
}, { cas, mode });
const n = (k, v) => Array(k).fill(v);

// 1. Exemple de l'éleveur : 100 à l'IA, 50 mises bas, 50 vides vendues -> 50 %
let r = await stats([...n(50, 'mb'), ...n(50, 'videVendue')], 'IA');
eq([r.s.effectif, r.s.ia.misesBas, r.s.ia.fertilite, r.s.global.fertilite, r.s.sorties], [100, 50, 50, 50, 0], '100 IA, 50 vides vendues : 50 %, jamais 100 %');
eq(r.libelle, 'Sorties avant mise bas : 50 vides (échec)', 'ligne grise : vides en échec');
eq(r.resume, [[100, 50]], 'résumé par groupe d\'âge : même taux');

// 2. 2 pleines mortes avant mise bas : réussite (fertilité) mais pas de prolificité
r = await stats([...n(48, 'mb'), ...n(2, 'pleineMorte'), ...n(50, 'videVendue')], 'IA');
eq([r.s.effectif, r.s.ia.misesBas, r.s.ia.pleinesSorties, r.s.ia.fertilite, r.s.ia.prolificite], [100, 48, 2, 50, 2], 'pleines mortes : fertilité 50 %, prolificité sur les 48 mises bas');
eq(r.libelle, 'Sorties avant mise bas : 50 vides (échec), 2 pleines', 'ligne grise : vides et pleines');

// 3. sans écho : hors taux, comptée à part ; pleine au retour morte : réussite du retour
r = await stats([...n(6, 'mb'), 'retourMorte', 'mbRetour', 'sansEchoVendue', 'videPresente'], 'IA');
eq([r.s.effectif, r.s.sorties, r.s.ia.fertilite, r.s.retour.misesBas, r.s.retour.pleinesSorties, r.s.retour.fertilite, r.s.global.fertilite], [9, 1, 66.7, 1, 1, 66.7, 88.9], 'sans écho hors taux ; retour mort = réussite du retour (2 sur 3 restantes)');
eq(r.libelle, 'Sorties avant mise bas : 1 pleine, 1 sans écho (hors taux)', 'ligne grise : pleine et sans écho');

// 4. éponge : même règle
r = await stats([...n(3, 'mb'), 'pleineMorte', ...n(2, 'videVendue'), 'sansEchoVendue'], 'EP');
eq([r.s.effectif, r.s.misesBas, r.s.pleinesSorties, r.s.fertilite, r.s.prolificite, r.s.sorties], [6, 3, 1, 66.7, 2, 1], 'éponge : vides en échec, pleine morte en réussite, sans écho hors taux');
eq(r.resume, [[6, 66.7]], 'éponge : résumé par groupe d\'âge');

// 5. une écho faite AVANT le lot ne compte pas (hors taux)
const avant = await p.evaluate(() => { const b = DB.brebis[DB.brebis.length - 1]; b.echographies = [{ type: 'stades', date: '2026-04-01', stade: 'Vide', campagne: 2026 }]; return issueSortieAvantMiseBasLot(DB.lots[0], b); });
eq(avant, null, 'écho antérieure au lot : ignorée');

await browser.close();
console.log('\nTOUS LES TESTS « SORTIES AVANT MISE BAS DANS LE BILAN DES LOTS » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
