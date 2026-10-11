/* Écran PC « Échographies » (menu de gauche), consultation seule : noyau de calcul COMMUN avec la carte « Dernière échographie » de l'accueil (dernière écho postérieure à la dernière mise bas, à date
   égale la dernière saisie, Vide définitive séparée de Vide, Avortée / pseudogestation à part), filtres (campagne, période, type, lot), « Par lot » (brebis dans deux lots, monte naturelle, lots de recherche
   et de réforme exclus, « Brebis uniques »), échos par semaine ; puis l'écran, l'historique, les exports et l'absence de saisie sur PC. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
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
eq([sans.R.total, sans.R.pleine, sans.R.vide, sans.R.videDefinitive, sans.R.cas, sans.R.sans], [16, 10, 1, 1, 2, 2], 'répartition : 16 brebis (la brebis vendue X garde son résultat figé : Pleine ; une brebis sortie sans écho n\'est pas comptée)');
eq(sans.R.stades, { 'Début': 1, 'Milieu': 2, 'Fin': 3, 'IA': 1, 'Retour 1': 0, 'Retour 2': 0, 'Tardive': 0, nonPrecise: 3 }, 'stades des pleines');
eq(sans.R.comptage, { un: 3, deux: 2, troisEtPlus: 2, sans: 3 }, 'comptage des pleines : 2 = 2 + Double ; 3 et + = 3 + « 4 et plus »');
console.log('OK 1 noyau commun : parité avec l\'accueil, règle écho postérieure à la mise bas, Vide définitive séparée.');

// ================================================================ 2. « Par lot » : monte naturelle, deux lots, brebis dans deux lots, lots de recherche et anciens exclus, Brebis uniques
eq(sans.parLot, [['Monte naturelle', 'Naturelle', 10, 6, 0, 1, 2, 1, 60], ['IA septembre', 'IA', 4, 3, 1, 0, 0, 0, 75], ['Éponge août', 'Éponge', 3, 2, 0, 0, 0, 1, 67]],
  'Par lot : P2 est dans IA septembre ET Éponge août (comptée dans chacun) ; le lot de recherche et le lot de 2024 n\'apparaissent pas');
check(sans.parLot.reduce((n, g) => n + g[2], 0) === 17 && sans.R.total === 16, 'somme des lots (17) > brebis uniques (16) : une brebis dans deux lots');
eq((await calc({ lot: 'mn' })).n, 10, 'filtre Lot « Monte naturelle » : les brebis dans aucun lot de reproduction');
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
eq([constat.R.pleine, constat.R.vide, constat.R.videDefinitive, constat.R.sans], [4, 2, 1, 9], 'type Constat : seules les échos de constat sont candidates');
const stades = await calc({ type: 'stades' });
eq(stades.R.total, 15, 'type Stades : population inchangée');
console.log('OK 3 filtres campagne, période, type.');

// ================================================================ 4. échos par semaine : semaine ISO, consécutives, jusqu'à la dernière avec échos
eq(sans.semaines, [[27, 2], [28, 0], [29, 0], [30, 0], [31, 16]], 'échos par semaine (S27 à S31)');
eq(sans.nbEchos, 18, 'nombre d\'échos');
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
// ================================================================ 6. aiguillage PC : consultation seule, la saisie n'existe plus (mobile inchangé)
await pc.evaluate(() => { echosPcEtat.onglet = 'historique'; render('echo-rapide'); });
const a1 = await pc.evaluate(() => ({ vue: currentView, ecran: !!document.getElementById('pc-echographies'), on: document.querySelector('#ep-onglets .on').textContent,
  saisie: ['#scan-echo', '#f-echo-session-combo', '#btn-start-echo-session', '#f-dernier-echo'].map(q => document.querySelectorAll(q).length), bulles: document.querySelectorAll('#app .info-bulle-btn').length, titre: pageTitle.textContent }));
eq(a1, { vue: 'echo-rapide', ecran: true, on: 'Résultats', saisie: [0, 0, 0, 0], bulles: 0, titre: 'Échographies' }, 'PC : l\'entrée du menu ouvre l\'onglet Résultats ; plus de session, de scan, de combinaison ni de case « dernière échographie » ; aucune bulle « ? »');
await pc.evaluate(() => render('historique-echo'));
eq(await pc.evaluate(() => [currentView, document.querySelector('#ep-onglets .on').textContent]), ['echo-rapide', 'Historique'], 'PC : « historique-echo » ouvre l\'onglet Historique de la même page');
const mob = await ouvrir(false);
await mob.evaluate(() => { resetEchoRapideSession(); render('echo-rapide'); });
eq(await mob.evaluate(() => ['#f-echo-session-combo', '#btn-start-echo-session', '#pc-echographies'].map(q => document.querySelectorAll(q).length)), [1, 1, 0], 'mobile : la saisie par session est inchangée');
await mob.evaluate(() => { currentSheepId = 'P1'; detailOrigin = 'list'; ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = 'P1'; render('detail', 'P1'); });
eq(await mob.evaluate(() => document.querySelectorAll('#btn-add-echo').length), 1, 'mobile : le bouton « + Échographie » de la fiche reste');
await pc.evaluate(() => { currentSheepId = 'P1'; detailOrigin = 'list'; ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = 'P1'; render('detail', 'P1'); });
eq(await pc.evaluate(() => [document.querySelectorAll('#btn-add-echo').length, !!document.getElementById('btn-add-agnelage')]), [0, true], 'PC : plus de bouton « + Échographie » sur la fiche d\'une brebis (« + Agnelage » reste)');
console.log('OK 6 PC : consultation seule, saisie retirée, mobile inchangé.');

// ================================================================ 7. onglet Résultats : tuiles, anneau, stades, comptage, par lot, semaines
await pc.evaluate(() => { echosPcEtat = { onglet: 'resultats', F: echoFiltresPcVides(), q: '', fRes: '', fCompt: '', nb: 20, histoDate: '' }; render('echo-rapide'); });
const T = await pc.evaluate(() => ({
  tuiles: [...document.querySelectorAll('.ep-tuile')].map(t => [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent, t.querySelector('.ep-ts').textContent, getComputedStyle(t).borderLeftColor]),
  anneau: [...document.querySelectorAll('.ep-lg div')].map(d => d.childNodes[1].textContent + ' ' + d.querySelector('b').textContent), centre: [...document.querySelectorAll('.ep-dn svg text')].map(t => t.textContent), cercles: document.querySelectorAll('.ep-dn svg circle').length,
  stades: [...document.querySelectorAll('.ep-g3 .ep-carte:nth-child(2) .ep-rp')].map(r => r.querySelector('span').textContent + ' ' + r.querySelector('b').textContent),
  comptage: [...document.querySelectorAll('.ep-g3 .ep-carte:nth-child(3) .ep-rp')].map(r => r.querySelector('span').textContent + ' ' + r.querySelector('b').textContent),
  lots: [...document.querySelectorAll('.ep-g2 table tbody tr')].map(r => [...r.children].slice(0, 6).map(c => c.textContent.trim()).join('|') + (r.classList.contains('ep-pied') ? ' (pied)' : '')),
  semaines: [...document.querySelectorAll('.ep-cl span')].map(x => x.textContent), colonnes: [...document.querySelectorAll('.ep-cols div')].map(d => d.firstChild.textContent),
  onglets: [...document.querySelectorAll('#ep-onglets button')].map(b => b.textContent), thFond: getComputedStyle(document.querySelector('table.ep-table th')).backgroundColor, thTexte: getComputedStyle(document.querySelector('table.ep-table th')).color,
  alt: [...document.querySelectorAll('.ep-g2 table tbody tr')].map(r => getComputedStyle(r.children[1]).backgroundColor) }));
eq(T.tuiles.map(t => t.slice(0, 3)), [['Pleines', '10', '63 % des brebis'], ['Vides', '1', '1 à repasser à l\'écho'], ['Vides définitives', '1', 'campagne 2027'], ['Avortées / pseudo.', '2', 'cas particuliers'], ['Sans échographie', '2', 'sur 16 brebis']], 'cinq tuiles = chiffres de l\'accueil');
eq(T.tuiles.map(t => t[3]), ['rgb(47, 110, 68)', 'rgb(163, 58, 49)', 'rgb(163, 58, 49)', 'rgb(181, 112, 28)', 'rgb(94, 91, 71)'], 'filets des tuiles : vert, rouge, rouge, ambre, gris');
eq(T.anneau, ['Pleine 10 · 63 %', 'Vide 1 · 6 %', 'Vide définitive 1 · 6 %', 'Avortée / pseudo. 2 · 13 %', 'Sans échographie 2 · 13 %'], 'légende de l\'anneau');
eq([T.centre, T.cercles], [['16', 'brebis'], 5], 'anneau SVG : total au centre, 5 segments');
eq(T.stades, ['Début 1', 'Milieu 2', 'Fin 3', 'IA 1', 'Retour 1 0', 'Retour 2 0', 'Tardive 0', 'Stade non précisé 3'], 'pleines par stade');
eq(T.comptage, ['1 agneau 3 (30 %)', '2 agneaux 2 (20 %)', '3 agneaux et + 2 (20 %)', 'Sans comptage 3 (30 %)'], 'pleines par comptage (1, 2, 3 et +, sans comptage)');
eq(T.lots, ['Monte naturelle|Naturelle|10|6|0|60 %', 'IA septembre|IA|4|3|1|75 %', 'Éponge août|Éponge|3|2|0|67 %', 'Brebis uniques||16|10|1|63 % (pied)'], 'Par lot : monte naturelle, lots IA / Éponge, brebis dans deux lots, Brebis uniques en pied');
eq([T.semaines, T.colonnes], [['S27', 'S28', 'S29', 'S30', 'S31'], ['2', '0', '0', '0', '16']], 'histogramme Échos par semaine');
eq([T.onglets, T.thFond, T.thTexte], [['Résultats', 'Historique'], 'rgb(53, 127, 75)', 'rgb(255, 255, 255)'], 'segmenté charte ; tableaux : en-tête vert, texte blanc');
check(T.alt[0] !== T.alt[1], 'lignes alternées');
// mise en page (retouches) : noms de lot sur une ligne sans rien couper dans « Par lot » ; cartes du haut alignées en haut, non étirées
const MEP = await pc.evaluate(() => {
  const lh = (el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
  const une = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getClientRects().length === 1 || [...r.getClientRects()].every(q => Math.abs(q.top - r.getClientRects()[0].top) < 3); };
  const tab = document.querySelector('.ep-g2 table'), tw = tab.parentElement;
  const cartes = [...document.querySelectorAll('.ep-g3 .ep-carte')].map(c => c.getBoundingClientRect());
  return { lots: [...tab.querySelectorAll('tbody td:first-child')].map(td => [td.textContent.trim(), getComputedStyle(td).whiteSpace, une(td), td.getBoundingClientRect().height <= lh(td) * 2.5]),
    coupe: tw.scrollWidth > tw.clientWidth + 1, thRep: (() => { const th = [...tab.querySelectorAll('th')].pop(), q = th.getBoundingClientRect(), t = tw.getBoundingClientRect(); return [th.textContent, q.right <= t.right + 1]; })(),
    largLot: tab.querySelector('th:first-child').getBoundingClientRect().width, largRep: [...tab.querySelectorAll('th')].pop().getBoundingClientRect().width,
    hauts: cartes.map(q => Math.round(q.top)), h: cartes.map(q => Math.round(q.height)), alignItems: getComputedStyle(document.querySelector('.ep-g3')).alignItems };
});
check(MEP.lots.every(l => l[1] === 'nowrap' && l[2] && l[3]), 'Par lot : chaque nom de lot tient sur une seule ligne (white-space:nowrap) : ' + JSON.stringify(MEP.lots));
check(!MEP.coupe && MEP.thRep[0] === 'Répartition' && MEP.thRep[1], 'Par lot : la colonne Répartition n\'est ni coupée ni rognée : ' + JSON.stringify(MEP));
check(MEP.largLot > MEP.largRep, 'Par lot : la colonne Lot est plus large que la colonne Répartition (' + MEP.largLot + ' > ' + MEP.largRep + ')');
check(MEP.alignItems === 'flex-start' || MEP.alignItems === 'start', 'cartes du haut : alignées en haut, non étirées (align-items ' + MEP.alignItems + ')');
check(MEP.hauts.every(t => t === MEP.hauts[0]) && MEP.h[0] < MEP.h[1] && MEP.h[2] < MEP.h[1], 'cartes du haut : même ligne de départ, hauteur propre à leur contenu (Résultat et Comptage plus courtes que Pleines par stade) : ' + JSON.stringify(MEP.h));
console.log('OK 7 Résultats : tuiles, anneau, stades, comptage, par lot, échos par semaine, tableaux à en-tête vert.');

// ================================================================ 8. filtres de l'écran (champs réels) et détail par brebis
await pc.selectOption('#ep-f-lot', 'EP1');
eq(await pc.evaluate(() => [document.querySelector('.ep-tuile .reg-tuile-v').textContent, document.querySelectorAll('#ep-detail-corps tbody tr').length]), ['2', 3], 'filtre Lot : Éponge août (3 brebis, 2 pleines)');
await pc.selectOption('#ep-f-lot', 'mn');
eq(await pc.evaluate(() => document.querySelectorAll('#ep-detail-corps tbody tr').length), 10, 'filtre Lot : Monte naturelle');
await pc.click('#ep-reinit');
await pc.selectOption('#ep-f-campagne', '2027');
eq(await pc.evaluate(() => [...document.querySelectorAll('.ep-tuile .reg-tuile-v')].map(x => x.textContent)), ['0', '0', '0', '0', '15'], 'filtre Campagne 2028 (2027 en interne) : aucune écho -> tout « Sans échographie »');
await pc.click('#ep-reinit');
await pc.selectOption('#ep-f-type', 'constat');
eq(await pc.evaluate(() => [...document.querySelectorAll('.ep-tuile .reg-tuile-v')].map(x => x.textContent)), ['4', '2', '1', '0', '9'], 'filtre Type Constat');
await pc.click('#ep-reinit');
await pc.fill('#ep-f-du', '2026-08-02'); await pc.dispatchEvent('#ep-f-du', 'change');
eq(await pc.evaluate(() => [...document.querySelectorAll('.ep-tuile .reg-tuile-v')].map(x => x.textContent)), ['0', '0', '1', '0', '14'], 'filtre Du 02/08 : plus aucune écho candidate (la vide définitive reste séparée)');
await pc.click('#ep-reinit');
// détail : recherche, filtres résultat / comptage, étiquette « Avant mise bas »
await pc.selectOption('#ep-f-res', 'sans');
const sansRows = await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(r => [...r.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).slice(0, 8).join('|')));
eq(sansRows.length, 2, 'filtre « Sans échographie » : 2 brebis');
check(sansRows.some(r => /Avant mise bas/.test(r) && /01-08-2026/.test(r)), '« Avant mise bas » : la brebis qui a mis bas depuis son écho est listée avec son écho d\'avant en grisé : ' + JSON.stringify(sansRows));
// détail : « Sans échographie » et l'étiquette « Avant mise bas » sur une seule ligne, sans coupure de la cellule Résultat
const unique = await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(tr => { const td = tr.children[4], vis = [...td.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > 0), tops = vis.map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)), tag = td.querySelector('.ep-tag');
  return { txt: td.textContent.replace(/\s+/g, ' ').trim(), ws: getComputedStyle(td).whiteSpace, centres: tops, tag: !!tag, h: Math.round(td.getBoundingClientRect().height), debord: td.scrollWidth > td.clientWidth + 1 }; }));
check(unique.length === 2 && unique.every(u => u.ws === 'nowrap' && !u.debord && Math.max(...u.centres) - Math.min(...u.centres) <= 4 && u.h <= 48), 'Détail : « Sans échographie » (+ étiquette « Avant mise bas ») sur une seule ligne, cellule Résultat non coupée : ' + JSON.stringify(unique));
check(unique.some(u => u.tag && u.txt === 'Sans échographie Avant mise bas'), 'Détail : l\'étiquette « Avant mise bas » est en toutes lettres à l\'écran, à côté de « Sans échographie »');
await pc.selectOption('#ep-f-res', '');
await pc.selectOption('#ep-f-compt', 'troisEtPlus');
eq(await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(r => [r.children[0].textContent, r.children[5].textContent])), [['n°00004', '3 et +'], ['8003', '3 et +']], 'filtre comptage « 3 et + »');
await pc.selectOption('#ep-f-compt', '');
await pc.fill('#ep-q', '8002');
eq(await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(r => [r.children[0].textContent, r.children[5].textContent, r.children[7].textContent])), [['8002', '2 et +', 'IA septembre, Éponge août']], 'recherche par n° court ; Double = « 2 et + » ; brebis dans deux lots : les deux lots listés');
check(await pc.evaluate(() => document.activeElement.id === 'ep-q'), 'la frappe garde le focus dans le champ de recherche');
await pc.fill('#ep-q', '');
console.log('OK 8 filtres de l\'écran, détail : recherche, résultat, comptage, Avant mise bas, lots multiples.');

// ================================================================ 9. pagination par 20 ; Modifier / Suppr. ; aucune écriture à l'affichage
await pc.evaluate(() => {
  const eid = (n) => '2500162999800' + String(n).padStart(3, '0') + '0';
  for (let i = 0; i < 12; i++) DB.brebis.push({ id: 'Z' + i, eid: eid(300 + i), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] });
  window.__avant = JSON.stringify(DB); window.__saves = 0; render('echo-rapide');
});
eq(await pc.evaluate(() => [document.querySelectorAll('#ep-detail-corps tbody tr').length, document.querySelector('.ep-ft').textContent.replace(/\s+/g, ' ').trim()]), [20, '1 à 20 sur 28Voir les 20 suivantes'], 'détail paginé par 20');
await pc.click('#ep-plus');
eq(await pc.evaluate(() => [document.querySelectorAll('#ep-detail-corps tbody tr').length, !!document.getElementById('ep-plus')]), [28, false], '« Voir les 20 suivantes »');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'l\'affichage et les filtres n\'écrivent rien');
await pc.fill('#ep-q', '8001');
await pc.click('#ep-detail-corps .ep-edit');
eq(await pc.evaluate(() => [currentView, currentSheepId]), ['add-echo', 'P1'], '« Modifier » ouvre l\'écran de modification existant de l\'écho');
await pc.evaluate(() => { echosPcEtat.q = '8001'; render('echo-rapide'); });
await pc.click('#ep-detail-corps .ep-del');
eq(await pc.evaluate(() => [DB.brebis.find(s => s.id === 'P1').echographies.length, window.__saves]), [0, 1], '« Suppr. » retire l\'écho (une écriture, confirmée)');
console.log('OK 9 pagination, Modifier, Suppr., aucune écriture à l\'affichage.');
// ================================================================ 10. onglet Historique : n° d'ordre de repli, campagne, comptage, pastille Vide définitive, filtre par date
await pc.evaluate(jeu);
await pc.evaluate(() => {
  const vd = DB.brebis.find(s => s.id === 'VD');
  vd.echographies.unshift({ date: '2026-06-01', type: 'constat', stade: 'Vide', campagne: 2026 });              // une écho Vide plus ancienne : sans pastille
  DB.brebis.find(s => s.id === 'N').echographies.push({ date: '2025-05-05', type: 'constat', stade: 'Pleine' });    // ancienne écho sans campagne : « — »
  window.__avant = JSON.stringify(DB); window.__saves = 0;
  echosPcEtat = { onglet: 'historique', F: echoFiltresPcVides(), q: '', fRes: '', fCompt: '', nb: 20, histoDate: '' }; render('historique-echo');
});
const H = await pc.evaluate(() => ({
  compte: document.getElementById('ep-histo-compte').textContent, cols: [...document.querySelectorAll('#ep-histo-table th')].map(t => t.textContent),
  lignes: [...document.querySelectorAll('#ep-histo-table tbody tr')].map(r => [...r.children].slice(0, 4).map(c => c.textContent.replace(/\s+/g, ' ').trim())),
  thFond: getComputedStyle(document.querySelector('#ep-histo-table th')).backgroundColor, bulles: document.querySelectorAll('#app .info-bulle-btn').length }));
eq(H.cols, ['N° court', 'Date', 'Campagne', 'Résultat', ''], 'colonnes de l\'historique (avec Campagne)');
eq(H.compte, '20 échographies', 'toutes les échos de toutes les brebis (la vendue comprise)');
const ligne = (num, date) => H.lignes.filter(l => l[0] === num && l[1] === date);
check(ligne('8001', '01-08-2026')[0][3] === 'Début 1' && ligne('8002', '01-08-2026')[0][3] === 'Milieu 2 et +' && ligne('8003', '01-08-2026')[0][3] === 'Fin 3 et + Parasitisme', 'comptage : 1, « 2 et + » (Double), « 3 et + » : ' + JSON.stringify(H.lignes.slice(0, 3)));
check(H.lignes.some(l => /^n°\d{5}$/.test(l[0])), 'n° d\'ordre à la place d\'un n° court absent (plus de cellule vide) : ' + JSON.stringify(H.lignes.map(l => l[0])));
check(H.lignes.every(l => l[0] !== ''), 'aucune cellule N° vide');
eq(H.lignes.filter(l => l[1] === '05-05-2025').map(l => l[2]), ['—'], 'ancienne écho sans campagne : « — »');
eq(H.lignes.filter(l => l[1] === '01-08-2026')[0][2], '2027', 'campagne de l\'écho (2026 en interne = campagne 2027)');
const vdl = H.lignes.filter(l => /Vide définitive/.test(l[3]));
eq(vdl.length, 1, 'pastille « Vide définitive » sur UNE seule ligne : la dernière écho Vide de la campagne');
check(/Vide Vide définitive · 2027 · 01-10-2026/.test(vdl[0][3]) && vdl[0][1] === '01-08-2026', 'pastille avec campagne et date de marquage, sur l\'écho du 01/08 (pas sur celle du 01/06) : ' + vdl[0].join(' | '));
check(H.lignes.filter(l => l[1] === '01-06-2026')[0][3] === 'Vide', 'l\'écho Vide plus ancienne n\'a pas la pastille');
eq([H.thFond, H.bulles], ['rgb(53, 127, 75)', 0], 'tableau charte (en-tête vert), aucune bulle « ? »');
await pc.fill('#ep-histo-date', '2026-07-01'); await pc.dispatchEvent('#ep-histo-date', 'change');
eq(await pc.evaluate(() => [document.getElementById('ep-histo-compte').textContent, document.querySelectorAll('#ep-histo-table tbody tr').length]), ['2 échographies', 2], 'filtre par date');
await pc.click('#ep-histo-toutes');
eq(await pc.evaluate(() => document.querySelectorAll('#ep-histo-table tbody tr').length), 20, '« Toutes »');
await pc.click('#ep-histo-table .ep-edit >> nth=0');
eq(await pc.evaluate(() => currentView), 'add-echo', '« Modifier » ouvre l\'écran de modification existant');
await pc.evaluate(() => { render('historique-echo'); });
await pc.click('#ep-histo-table .ep-del >> nth=0');
eq(await pc.evaluate(() => [DB.brebis.reduce((n, s) => n + (s.echographies || []).length, 0), window.__saves]), [19, 1], '« Suppr. » retire une écho (une écriture)');
console.log('OK 10 Historique : n° d\'ordre, campagne, comptage, pastille Vide définitive, filtre par date, Modifier / Suppr.');
// ================================================================ 11. exports Excel et PDF des résultats (vue filtrée, charte, colonnes d'écho)
await pc.evaluate(jeu);
await pc.evaluate(() => {
  window.__xlsx = []; window.__fich = [];
  buildXlsxWorkbook = async feuilles => { window.__xlsx.push(feuilles); return new Uint8Array([1, 2, 3]); };
  saveOrShareBinaryFile = async (nom, bytes, mime) => { let s = ''; for (const x of bytes) s += String.fromCharCode(x); window.__fich.push({ nom, mime, b64: btoa(s) }); };
  echosPcEtat = { onglet: 'resultats', F: echoFiltresPcVides(), q: '', fRes: '', fCompt: '', nb: 20, histoDate: '' }; render('echo-rapide'); window.__avant = JSON.stringify(DB); window.__saves = 0;
});
await pc.click('#ep-export-xlsx'); await pc.waitForTimeout(100);
const xl = await pc.evaluate(() => window.__xlsx[0]);
eq(xl.map(f => f.name), ['Résumé', 'Détail'], 'Excel : deux feuilles');
eq(xl[1].rows[0], ['N° court', 'Millésime', 'Âge', 'Résultat', 'Dernière écho', 'Type', 'Stade / cas', 'Comptage', 'Cas particulier', 'Lots', 'Avant mise bas', 'Statut'], 'Excel Détail : colonnes d\'écho (date, type, résultat, comptage, cas particulier, lots)');
eq(xl[1].rows.length, 17, 'Excel Détail : toutes les brebis de la vue (16 + en-tête), pas seulement 20 lignes');
const l8002 = xl[1].rows.find(r => r[0] === '8002'), lMB = xl[1].rows.find(r => r[3] === 'Sans échographie' && r[10] === 'Avant mise bas'), l8003 = xl[1].rows.find(r => r[0] === '8003');
eq(l8002, ['8002', 2018, 8, 'Pleine', '01-08-2026', 'Stades', 'Milieu', '2 et +', '', 'IA septembre, Éponge août', '', 'Présente'], 'Excel : ligne d\'une brebis dans deux lots, Double = « 2 et + »');
eq([l8003[7], l8003[8]], ['3 et +', 'Parasitisme'], 'Excel : « 3 et + » et cas particulier');
check(!!lMB && lMB[4] === '01-08-2026', 'Excel : « Avant mise bas » avec la date de l\'écho d\'avant');
const txt = xl[0].rows.map(r => r.join(' | '));
check(txt.some(r => /^Filtres \| Campagne : toutes/.test(r)) && txt.some(r => /^Pleine \| 10 \| 63 %/.test(r)) && txt.some(r => /^Brebis uniques \| {2}\| 16 \| 10/.test(r)) && txt.some(r => /^S31 \| semaine du 27-07-2026 \| 16/.test(r)) && txt.some(r => /^Début \| 1 \| 6 %/.test(r)) && txt.some(r => /^3 agneaux et \+ \| 2 \| 20 %/.test(r)), 'Excel Résumé : filtres, répartitions, par lot (Brebis uniques), échos par semaine : ' + txt.slice(0, 12).join(' / '));
// la vue filtrée (lot + recherche du détail) est exportée
await pc.selectOption('#ep-f-lot', 'EP1'); await pc.fill('#ep-q', '8002');
await pc.evaluate(() => { window.__xlsx = []; });
await pc.click('#ep-export-xlsx'); await pc.waitForTimeout(100);
const xl2 = await pc.evaluate(() => window.__xlsx[0]);
check(/Lot : Éponge août/.test(xl2[0].rows.map(r => r.join(' ')).join(' ')), 'Excel : le filtre Lot figure dans le résumé');
eq(xl2[1].rows.slice(1).map(r => r[0]).sort(), ['8002'], 'Excel Détail : suit le filtre Lot et la recherche');
await pc.click('#ep-reinit');
// PDF : charte colorée, relu avec PyMuPDF
await pc.evaluate(() => { window.__fich = []; });
await pc.click('#ep-export-pdf'); await pc.waitForTimeout(300);
const pdf = await pc.evaluate(() => window.__fich[0]);
eq([pdf.nom, pdf.mime], ['echographies_resultats_2026-10-03.pdf', 'application/pdf'], 'PDF : nom et type');
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-echos-')), f = path.join(dir, 'echos.pdf');
writeFileSync(f, Buffer.from(pdf.b64, 'base64'));
const PY = `
import sys, json, pymupdf
d = pymupdf.open(sys.argv[1])
txt = [p.get_text() for p in d]
verts = 0
for p in d:
    for dr in p.get_drawings():
        c = dr.get('fill')
        if c and abs(c[0]-53/255) < .01 and abs(c[1]-127/255) < .01 and abs(c[2]-75/255) < .01: verts += 1
ent = []
for p in d:
    nc = [q for q in p.search_for('N° court') if p.get_textbox(q).strip() == 'N° court']
    if not nc: continue
    for w in ['N° court', 'Millésime', 'Âge', 'Résultat', 'Dernière écho', 'Type', 'Stade / cas', 'Comptage', 'Cas particulier', 'Lots', 'Avant MB']:
        for q in p.search_for(w):
            if p.get_textbox(q).strip() == w and abs(q.y0 - nc[0].y0) < 3:
                ent.append([w, round(q.x1), round(p.rect.width)]); break
print(json.dumps({ 'pages': len(d), 'txt': txt, 'verts': verts, 'ent': ent }))
`;
const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8' });
check(r.status === 0, 'lecture du PDF : ' + r.stderr);
const P = JSON.parse(r.stdout), TXT = P.txt.join('\n');
check(P.pages >= 2 && P.verts >= 6, 'PDF : plusieurs pages, en-têtes de tableau verts #357f4b (' + P.verts + ' éléments)');
for (const motif of ['Échographies · résultats', 'Campagne : toutes · 16 brebis comptées (résultat figé)', 'Pleines', 'Vides définitives', 'Sans échographie', 'Résultat', 'Pleines par stade', 'Pleines par comptage', 'Par lot', 'Brebis uniques', 'Échos par semaine', 'Détail par brebis', 'Avant MB : dernière écho antérieure à la dernière mise bas', 'IA septembre, Éponge août', 'Page 1/' + P.pages, 'Page ' + P.pages + '/' + P.pages, 'Ovilog · Échographies · résultats'])
  check(TXT.includes(motif), 'PDF contient « ' + motif + ' »');
// page du détail : en-têtes complets (aucune troncature « … »), « Comptage » en entier, dernière colonne « Avant MB » + note en pied de page
check(!TXT.includes('…') && !TXT.includes('...'), 'PDF : aucune troncature (« … ») dans le texte');
for (const h of ['Comptage', 'Cas particulier', 'Dernière écho', 'Stade / cas', 'Avant MB', 'Millésime'])
  check(TXT.includes(h), 'PDF : en-tête « ' + h + ' » en entier');
check(!/Avant mise b/.test(TXT.split('Détail par brebis')[1] || ''), 'PDF : « Avant mise bas » n\'est plus l\'en-tête de la dernière colonne (remplacé par « Avant MB »)');
check(P.ent.length >= 22 && P.ent.length % 11 === 0, 'PDF : l\'en-tête du détail est répété à chaque page du détail, 11 colonnes complètes (' + P.ent.length + ')');
eq(P.ent.slice(0, 11).map(e => e[0]), ['N° court', 'Millésime', 'Âge', 'Résultat', 'Dernière écho', 'Type', 'Stade / cas', 'Comptage', 'Cas particulier', 'Lots', 'Avant MB'], 'PDF : les 11 en-têtes du détail sont lisibles sur le bandeau vert, dans l\'ordre');
check(P.ent.every(e => e[1] <= e[2] - 20), 'PDF : aucun en-tête ne dépasse la marge droite de la page');
check(P.txt.slice(1).some(t => t.includes('Avant MB : dernière écho antérieure à la dernière mise bas (brebis comptée « Sans échographie »)')), 'PDF : la note « Avant MB » figure en pied de page du détail');
check(Math.max(...P.ent.filter(e => e[0] === 'Lots').map(e => e[1])) > 0 && P.ent.find(e => e[0] === 'Lots')[1] < P.ent.find(e => e[0] === 'Avant MB')[1] - 30, 'PDF : la colonne Lots est réduite, « Avant MB » reste à sa droite');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'les exports n\'écrivent rien');
console.log('OK 11 Exports : Excel (Résumé + Détail, colonnes d\'écho, vue filtrée), PDF charte colorée (tuiles, tableaux verts, Page X/Y), aucune écriture.');
await browser.close();
console.log('\nTOUS LES TESTS DES CALCULS DE L\'ÉCRAN PC ÉCHOGRAPHIES SONT PASSÉS.');
