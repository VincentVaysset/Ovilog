/* Écran PC « Échographies » (menu de gauche), consultation seule, trois onglets : « Aujourd'hui » (réel à l'instant t : chaque brebis une fois, d'après sa mise bas
   et sa dernière écho de la campagne ; par lot en chiffres réels, sans % ; détail paginé), « Passages » (un jour d'écho, résultat figé, par lot, Repassées / 1re écho,
   devenir des pleines) et « Historique » ; plus d'histogramme « Échos par semaine » ; exports qui suivent l'onglet ; aucune saisie sur PC. Jeu SYNTHÉTIQUE, saveData
   REMPLACÉ, aucune donnée réelle. */
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
  const eid = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
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
const jour = (C, lot) => pc.evaluate(({ C, lot }) => { const d = donneesEchoJour(C, lot); return { T: d.T, stades: d.stades, comptage: d.comptage, parLot: d.parLot.map(g => [g.nom, g.mode, g.brebis, g.aMettreBas, g.misBas, g.vide, g.videDef, g.cas, g.sortie, g.pasPassee]), cats: Object.fromEntries(d.lignes.map(r => [r.id, r.sit.cat])) }; }, { C, lot });

// ================================================================ 1. Aujourd'hui : chaque brebis une fois (mise bas, sinon dernière écho de la campagne)
const J = await jour(2026, '');
eq(J.T, { brebis: 16, aMettreBas: 8, misBas: 2, vide: 1, videDef: 1, cas: 2, pasPassee: 1, sortie: 1 }, 'Aujourd\'hui : 16 brebis (la vendue X est une sortie, plus une pleine)');
eq([J.cats.TIE, J.cats.MB, J.cats.MB2, J.cats.N, J.cats.X, J.cats.VD], ['aMettreBas', 'misBas', 'misBas', 'pasPassee', 'sortie', 'videDef'], 'à date égale la dernière saisie ; mise bas de la campagne = « Ont mis bas »');
eq(J.stades, { 'Début': 1, 'Milieu': 1, 'Fin': 3, 'IA': 1, 'Retour 1': 0, 'Retour 2': 0, 'Tardive': 0, nonPrecise: 2 }, 'stades des seules pleines à mettre bas');
eq(J.comptage, { un: 3, deux: 1, troisEtPlus: 2, sans: 2 }, 'comptage des pleines à mettre bas');
eq(J.parLot, [['Monte naturelle', '', 12, 5, 2, 0, 1, 2, 1, 1], ['IA septembre', 'IA', 4, 3, 0, 1, 0, 0, 0, 0]], 'par lot (lots visant la campagne ; recherche, éponge 2027 et lot 2024 exclus), chiffres réels');
eq([(await jour(2026, 'mn')).T.brebis, (await jour(2026, 'IA1')).T.brebis], [12, 4], 'filtre lot');
eq((await jour(2027, '')).T, { brebis: 15, aMettreBas: 0, misBas: 0, vide: 0, videDef: 0, cas: 0, pasPassee: 15, sortie: 0 }, 'campagne 2027 : aucune écho, la vendue sans écho n\'est pas comptée');
console.log('OK 1 Aujourd\'hui : une fois par brebis, par lot réel, campagne.');

// ================================================================ 2. Passages : un par date, figés, par lot, repassées, devenir
const P = await pc.evaluate(() => passagesEchoCampagne(2026).map(x => ({ date: x.date, t: [x.total.passees, x.total.pleines, x.total.vides, x.total.cas, x.total.reussite], c: x.total.comptage, rep: [x.repassees.passees, x.repassees.pleines], pre: [x.premiere.passees, x.premiere.pleines], dev: x.devenir, lots: x.parLot.map(g => [g.nom, g.passees, g.pleines, g.vides, g.reussite]) })));
eq(P.map(x => x.date), ['2026-08-01', '2026-07-01'], 'deux passages, le plus récent d\'abord');
eq(P[0].t, [15, 11, 2, 2, 85], '01-08 : 15 passées (la vendue comprise), 11 pleines, 2 vides, 2 cas, 85 %');
eq(P[0].c, { un: 3, deux: 2, troisEtPlus: 2, sans: 4 }, '01-08 : comptage au jour de l\'écho');
eq([P[0].rep, P[0].pre], [[2, 2], [13, 9]], '01-08 : repassées (T1, T2) et 1re écho');
eq(P[0].dev, { misBas: 1, restent: 9, sorties: 1 }, '01-08 : devenir des pleines (une mise bas antérieure ne compte pas)');
eq(P[0].lots, [['Monte naturelle', 11, 8, 1, 89], ['IA septembre', 4, 3, 1, 75]], '01-08 : par lot au jour de l\'écho');
eq(P[1].t, [2, 2, 0, 0, 100], '07-01 : 2 passées, 2 pleines');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture');
console.log('OK 2 Passages : figés, par lot, repassées, devenir.');

// ================================================================ 6. aiguillage PC : consultation seule, la saisie n'existe plus (mobile inchangé)
await pc.evaluate(() => { echosPcEtat.onglet = 'aujourdhui'; render('echo-rapide'); });
const a1 = await pc.evaluate(() => ({ vue: currentView, ecran: !!document.getElementById('pc-echographies'), on: document.querySelector('#ep-onglets .on').textContent,
  saisie: ['#scan-echo', '#echo-type', '#echo-comptage', '#f-echo-lot', '#btn-start-echo-session', '#f-dernier-echo', '#btn-valider-echo', '#btn-passer-echo'].map(q => document.querySelectorAll(q).length), bulles: document.querySelectorAll('#app .info-bulle-btn').length, titre: pageTitle.textContent }));
eq(a1, { vue: 'echo-rapide', ecran: true, on: 'Aujourd\'hui', saisie: [0, 0, 0, 0, 0, 0, 0, 0], bulles: 0, titre: 'Échographies' }, 'PC : l\'entrée du menu ouvre l\'onglet Aujourd\'hui ; plus de session, de scan, de combinaison ni de case « dernière échographie » ; aucune bulle « ? »');
await pc.evaluate(() => render('historique-echo'));
eq(await pc.evaluate(() => [currentView, document.querySelector('#ep-onglets .on').textContent]), ['echo-rapide', 'Historique'], 'PC : « historique-echo » ouvre l\'onglet Historique de la même page');
const mob = await ouvrir(false);
await mob.evaluate(() => { resetEchoRapideSession(); render('echo-rapide'); });
eq(await mob.evaluate(() => ['#echo-type', '#echo-comptage', '#f-echo-lot', '#f-echo-date', '#f-dernier-echo', '#btn-start-echo-session', '#pc-echographies'].map(q => document.querySelectorAll(q).length)), [1, 1, 1, 1, 1, 1, 0], 'mobile : l\'écran de session (type, comptage, lot, date, dernière écho, démarrer) existe, sans écran PC');
await mob.evaluate(() => { currentSheepId = 'P1'; detailOrigin = 'list'; ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = 'P1'; render('detail', 'P1'); });
eq(await mob.evaluate(() => document.querySelectorAll('#btn-add-echo').length), 1, 'mobile : le bouton « + Échographie » de la fiche reste');
await pc.evaluate(() => { currentSheepId = 'P1'; detailOrigin = 'list'; ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = 'P1'; render('detail', 'P1'); });
eq(await pc.evaluate(() => [document.querySelectorAll('#btn-add-echo').length, !!document.getElementById('btn-add-agnelage')]), [0, true], 'PC : plus de bouton « + Échographie » sur la fiche d\'une brebis (« + Agnelage » reste)');
console.log('OK 6 PC : consultation seule, saisie retirée, mobile inchangé.');


// ================================================================ 7. onglet Aujourd'hui : tuiles, ligne grise, anneau, stades, comptage, par lot ; plus d'histogramme
await pc.evaluate(() => { echosPcEtat = { onglet: 'aujourdhui', campagne: null, lot: '', q: '', fCat: '', nb: 20, passage: null, vuePassage: 'toutes', histoDate: '' }; render('echo-rapide'); });
const T = await pc.evaluate(() => ({
  onglets: [...document.querySelectorAll('#ep-onglets button')].map(b => b.textContent),
  tuiles: [...document.querySelectorAll('#ep-tuiles-jour .ep-tuile')].map(t => [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent]),
  ligne: document.getElementById('ep-ligne-jour').textContent, aussi: document.getElementById('ep-aussi').textContent,
  anneau: [...document.querySelectorAll('.ep-lg div')].map(d => d.childNodes[1].textContent + ' ' + d.querySelector('b').textContent), centre: [...document.querySelectorAll('.ep-dn svg text')].map(t => t.textContent),
  stades: [...document.querySelectorAll('.ep-g3 .ep-carte:nth-child(2) .ep-rp')].map(r => r.querySelector('span').textContent + ' ' + r.querySelector('b').textContent),
  comptage: [...document.querySelectorAll('.ep-g3 .ep-carte:nth-child(3) .ep-rp')].map(r => r.querySelector('span').textContent + ' ' + r.querySelector('b').textContent),
  lots: [...document.querySelectorAll('#ep-parlot-jour tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join('|')), lotsTete: [...document.querySelectorAll('#ep-parlot-jour th')].map(t => t.textContent),
  histo: document.querySelectorAll('.ep-cols, .ep-cl').length + (/Échos par semaine/.test(document.getElementById('app').textContent) ? 1 : 0),
  thFond: getComputedStyle(document.querySelector('table.ep-table th')).backgroundColor, thTexte: getComputedStyle(document.querySelector('table.ep-table th')).color }));
eq(T.onglets, ['Aujourd\'hui', 'Passages', 'Historique'], 'trois onglets');
eq(T.tuiles, [['pleines, à mettre bas', '8'], ['ont mis bas', '2'], ['vides', '1'], ['pas encore passées', '1']], 'quatre tuiles');
check(/^Situation au 03-10-2026 · chaque brebis une fois, d'après sa dernière écho de la campagne · 16 brebis\.$/.test(T.ligne), 'ligne « Situation au … » : ' + T.ligne);
eq(T.aussi, 'Aussi : 1 vide définitive · 2 avortées / pseudo. · 1 sortie.', 'ligne grise des autres situations');
eq(T.anneau, ['Pleines, à mettre bas 8 · 50 %', 'Ont mis bas 2 · 13 %', 'Vides 1 · 6 %', 'Vides définitives 1 · 6 %', 'Avortées / pseudo. 2 · 13 %', 'Pas encore passées 1 · 6 %', 'Sorties 1 · 6 %'], 'légende de l\'anneau (catégories du jour, « Sans échographie » disparue)');
eq(T.centre, ['16', 'brebis'], 'total au centre');
eq(T.stades, ['Début 1', 'Milieu 1', 'Fin 3', 'IA 1', 'Stade non précisé 2'], 'stades des pleines à mettre bas (lignes à 0 masquées)');
eq(T.comptage, ['1 agneau 3 (38 %)', '2 et + 1 (13 %)', '3 et + 2 (25 %)', 'Sans comptage 2 (25 %)'], 'comptage des pleines à mettre bas');
eq(T.lotsTete, ['Lot', 'Mode', 'Brebis', 'À mettre bas', 'Ont mis bas', 'Vides', 'Vides déf.', 'Avortées', 'Sorties', 'Pas encore passées'], 'par lot : colonnes réelles, aucun %');
eq(T.lots, ['Monte naturelle||12|5|2|0|1|2|1|1', 'IA septembre|IA|4|3|0|1|0|0|0|0'], 'par lot aujourd\'hui');
eq(T.histo, 0, 'plus d\'histogramme « Échos par semaine »');
eq([T.thFond, T.thTexte], ['rgb(53, 127, 75)', 'rgb(255, 255, 255)'], 'tableaux : en-tête vert, texte blanc');
console.log('OK 7 Aujourd\'hui : tuiles, ligne grise, anneau, stades, comptage, par lot, sans histogramme.');

// ================================================================ 8. filtres de l'écran et détail par brebis
await pc.selectOption('#ep-f-lot', 'IA1');
eq(await pc.evaluate(() => [document.querySelector('#ep-tuiles-jour .reg-tuile-v').textContent, document.querySelectorAll('#ep-detail-corps tbody tr').length]), ['3', 4], 'filtre Lot : IA septembre (4 brebis, 3 à mettre bas)');
await pc.selectOption('#ep-f-lot', '');
await pc.selectOption('#ep-f-campagne', '2027');
eq(await pc.evaluate(() => [...document.querySelectorAll('#ep-tuiles-jour .reg-tuile-v')].map(x => x.textContent)), ['0', '0', '0', '15'], 'campagne 2028 (2027 en interne) : toutes pas encore passées');
await pc.selectOption('#ep-f-campagne', '2026');
await pc.selectOption('#ep-f-cat', 'misBas');
const mbRows = await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(r => [...r.children].slice(0, 5).map(c => c.textContent.replace(/\s+/g, ' ').trim())));
eq(mbRows.length, 2, 'filtre « Ont mis bas » : 2 brebis');
check(mbRows.some(r => r[2] === 'Mise bas le 25-09-2026' && r[3] === '01-08-2026 · Pleine'), 'pastille « Mise bas le … » et dernière écho en gris : ' + JSON.stringify(mbRows));
await pc.selectOption('#ep-f-cat', 'sortie');
eq(await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(r => r.children[2].textContent)), ['Vendue'], 'la vendue : pastille de statut');
await pc.selectOption('#ep-f-cat', '');
await pc.fill('#ep-q', '8002');
eq(await pc.evaluate(() => [...document.querySelectorAll('#ep-detail-corps tbody tr')].map(r => [r.children[0].textContent, r.children[2].textContent, r.children[4].textContent, r.children[5].textContent])), [['8002', 'À mettre bas', '2 et +', 'IA septembre']], 'recherche par n° court ; Double = « 2 et + »');
check(await pc.evaluate(() => document.activeElement.id === 'ep-q'), 'la frappe garde le focus dans le champ de recherche');
await pc.fill('#ep-q', '');
const debord = await pc.evaluate(() => { const tw = document.querySelector('#ep-detail-corps .ep-tw'); return tw.scrollWidth > tw.clientWidth + 1; });
check(!debord, 'détail : le tableau tient dans la carte (Modifier / Suppr. visibles)');
console.log('OK 8 filtres, détail : situation, dernière écho, recherche.');

// ================================================================ 9. pagination par 20 ; Modifier / Suppr. ; aucune écriture à l'affichage
await pc.evaluate(() => {
  const eid = (n) => '2500000129800' + String(n).padStart(3, '0') + '0';
  for (let i = 0; i < 12; i++) DB.brebis.push({ id: 'Z' + i, eid: eid(300 + i), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] });
  window.__avant = JSON.stringify(DB); window.__saves = 0; render('echo-rapide');
});
eq(await pc.evaluate(() => [document.querySelectorAll('#ep-detail-corps tbody tr').length, document.querySelector('#ep-detail-corps .ep-pg').textContent.replace(/\s+/g, ' ').trim()]), [20, '1 à 20 sur 28Voir les 20 suivantes'], 'détail paginé par 20');
await pc.click('#ep-plus');
eq(await pc.evaluate(() => [document.querySelectorAll('#ep-detail-corps tbody tr').length, !!document.getElementById('ep-plus')]), [28, false], '« Voir les 20 suivantes »');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'l\'affichage et les filtres n\'écrivent rien');
await pc.fill('#ep-q', '8001');
await pc.click('#ep-detail-corps .ep-edit');
eq(await pc.evaluate(() => [currentView, currentSheepId]), ['add-echo', 'P1'], '« Modifier » ouvre l\'écran de modification existant de l\'écho');
await pc.evaluate(() => { echosPcEtat.q = '8001'; render('echo-rapide'); });
await pc.click('#ep-detail-corps .ep-del');
eq(await pc.evaluate(() => [DB.brebis.find(s => s.id === 'P1').echographies.length, window.__saves]), [0, 1], '« Suppr. » retire l\'écho (une écriture, confirmée)');
await pc.evaluate(() => { echosPcEtat.q = ''; });
console.log('OK 9 pagination, Modifier, Suppr., aucune écriture à l\'affichage.');

// ================================================================ 9 bis. onglet Passages : tableau, passage ouvert, sous-onglets, par lot, brebis
await pc.evaluate(jeu);
await pc.evaluate(() => { echosPcEtat.passage = null; echosPcEtat.vuePassage = 'toutes'; render('echo-rapide'); });
await pc.click('#ep-onglets button[data-o="passages"]');
const PA = await pc.evaluate(() => ({
  lignes: [...document.querySelectorAll('#ep-passages tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join('|')), sel: document.querySelector('#ep-passages tr.ep-sel').dataset.date,
  titre: document.querySelector('#ep-panneau-passage h3').textContent, vues: [...document.querySelectorAll('#ep-vue-passage button')].map(b => b.textContent),
  lots: [...document.querySelectorAll('#ep-parlot-passage tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join('|')), brebis: document.querySelectorAll('#ep-brebis-passage tbody tr').length }));
eq(PA.lignes, ['01-08-2026|15|11|2|85 %|3|2|2|2 → 2 pleines|13 → 9 pleines|1|9|1', '01-07-2026|2|2|0|100 %|0|1|0|—|2 → 2 pleines|0|2|0'], 'tableau des passages');
eq([PA.sel, PA.titre, PA.vues], ['2026-08-01', 'Passage du 01-08-2026', ['Toutes 15', 'Repassées 2', '1re écho 13']], 'le plus récent est ouvert, sous-onglets avec effectifs');
eq(PA.lots, ['Monte naturelle|11|8|1|89 %|2|1|2', 'IA septembre|4|3|1|75 %|1|1|0'], 'par lot au jour de l\'écho');
eq(PA.brebis, 15, 'toutes les brebis du passage');
await pc.click('#ep-vue-passage button[data-v="repassees"]');
const rep = await pc.evaluate(() => [...document.querySelectorAll('#ep-brebis-passage tbody tr')].map(r => [...r.children].slice(0, 5).map(c => c.textContent.trim())));
eq(rep.map(r => r[3]), ['Pleine · Milieu le 01-07-2026', 'Pleine le 01-07-2026'], 'repassées : écho précédente en gris');
await pc.click('#ep-passages tr[data-date="2026-07-01"]');
eq(await pc.evaluate(() => [document.querySelector('#ep-panneau-passage h3').textContent, document.querySelectorAll('#ep-brebis-passage tbody tr').length]), ['Passage du 01-07-2026', 2], 'cliquer sur un passage l\'ouvre');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'onglet Passages : aucune écriture');
console.log('OK 9 bis Passages : tableau, passage ouvert, sous-onglets, par lot, brebis.');
// ================================================================ 10. onglet Historique : n° d'ordre de repli, campagne, comptage, pastille Vide définitive, filtre par date
await pc.evaluate(jeu);
await pc.evaluate(() => {
  const vd = DB.brebis.find(s => s.id === 'VD');
  vd.echographies.unshift({ date: '2026-06-01', type: 'constat', stade: 'Vide', campagne: 2026 });              // une écho Vide plus ancienne : sans pastille
  DB.brebis.find(s => s.id === 'N').echographies.push({ date: '2025-05-05', type: 'constat', stade: 'Pleine' });    // ancienne écho sans campagne : « — »
  window.__avant = JSON.stringify(DB); window.__saves = 0;
  echosPcEtat.onglet = 'historique'; echosPcEtat.histoDate = ''; render('historique-echo');
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
// ================================================================ 11. exports Excel et PDF (suivent l'onglet)
await pc.evaluate(jeu);
await pc.evaluate(() => {
  window.__xlsx = []; window.__fich = [];
  buildXlsxWorkbook = async feuilles => { window.__xlsx.push(feuilles); return new Uint8Array([1, 2, 3]); };
  saveOrShareBinaryFile = async (nom, bytes, mime) => { let s = ''; for (const x of bytes) s += String.fromCharCode(x); window.__fich.push({ nom, mime, b64: btoa(s) }); };
  echosPcEtat = { onglet: 'aujourdhui', campagne: null, lot: '', q: '', fCat: '', nb: 20, passage: null, vuePassage: 'toutes', histoDate: '' }; render('echo-rapide'); window.__avant = JSON.stringify(DB); window.__saves = 0;
});
await pc.click('#ep-export-xlsx'); await pc.waitForTimeout(100);
const xl = await pc.evaluate(() => window.__xlsx[0]);
eq(xl.map(f => f.name), ['Résumé', 'Détail'], 'Excel Aujourd\'hui : deux feuilles');
eq(xl[1].rows[0], ['N° court', 'Millésime', 'Aujourd\'hui', 'Dernière écho', 'Résultat', 'Comptage', 'Lots'], 'Excel Détail : colonnes');
eq(xl[1].rows.length, 17, 'Excel Détail : toutes les brebis de la vue (16 + en-tête)');
eq(xl[1].rows.find(r => r[0] === '8002'), ['8002', 2018, 'À mettre bas', '01-08-2026', 'Pleine · Milieu', '2 et +', 'IA septembre'], 'Excel : ligne d\'une pleine à mettre bas');
const txt = xl[0].rows.map(r => r.join(' | '));
check(txt.some(r => /^Filtres \| Campagne 2027 · en cours · Lot : tous/.test(r)) && txt.some(r => /^Pleines, à mettre bas \| 8 \| 50 %/.test(r)) && txt.some(r => /^Monte naturelle \| {2}\| 12 \| 5 \| 2/.test(r)) && !txt.some(r => /semaine/i.test(r)), 'Excel Résumé : filtres, situations, par lot, aucune semaine : ' + txt.slice(0, 12).join(' / '));
await pc.fill('#ep-q', '8002');
await pc.evaluate(() => { window.__xlsx = []; });
await pc.click('#ep-export-xlsx'); await pc.waitForTimeout(100);
eq(await pc.evaluate(() => window.__xlsx[0][1].rows.slice(1).map(r => r[0])), ['8002'], 'Excel Détail : suit la recherche');
await pc.fill('#ep-q', '');
await pc.evaluate(() => { window.__fich = []; });
await pc.click('#ep-export-pdf'); await pc.waitForTimeout(300);
const pdf = await pc.evaluate(() => window.__fich[0]);
eq([pdf.nom, pdf.mime], ['echographies_aujourdhui_2026-10-03.pdf', 'application/pdf'], 'PDF Aujourd\'hui : nom et type');
const lirePdf = (b64, entetes) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-echos-')), f = path.join(dir, 'echos.pdf');
  writeFileSync(f, Buffer.from(b64, 'base64'));
  const PY = `
import sys, json, pymupdf
d = pymupdf.open(sys.argv[1])
txt = [p.get_text() for p in d]
verts = 0
for p in d:
    for dr in p.get_drawings():
        c = dr.get('fill')
        if c and abs(c[0]-53/255) < .01 and abs(c[1]-127/255) < .01 and abs(c[2]-75/255) < .01: verts += 1
print(json.dumps({ 'pages': len(d), 'txt': txt, 'verts': verts }))
`;
  const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8' });
  check(r.status === 0, 'lecture du PDF : ' + r.stderr);
  return JSON.parse(r.stdout);
};
let L = lirePdf(pdf.b64), TXT = L.txt.join('\n');
check(L.verts >= 5, 'PDF : en-têtes de tableau verts #357f4b (' + L.verts + ')');
for (const motif of ['Échographies · aujourd\'hui', 'Pleines, à mettre bas', 'Ont mis bas', 'Pas encore passées', 'Aussi : 1 vide définitive · 2 avortées / pseudo. · 1 sortie.', 'Par lot · aujourd\'hui', 'Détail par brebis', 'Dernière écho', 'Page 1/' + L.pages, 'Ovilog — Échographies · aujourd\'hui'])
  check(TXT.includes(motif), 'PDF Aujourd\'hui contient « ' + motif + ' »');
check(!TXT.includes('…') && !/semaine/i.test(TXT), 'PDF : aucune troncature, aucune semaine');
// onglet Passages : exports du tableau et du passage ouvert
await pc.click('#ep-onglets button[data-o="passages"]');
await pc.evaluate(() => { window.__xlsx = []; window.__fich = []; });
await pc.click('#ep-export-xlsx'); await pc.waitForTimeout(100);
const xp = await pc.evaluate(() => window.__xlsx[0]);
eq(xp.map(f => f.name), ['Passages', 'Passage 01-08-2026'], 'Excel Passages : tableau + passage ouvert');
check(xp[0].rows.some(r => r[0] === '01-08-2026' && r[1] === 15 && r[4] === '85 %') && xp[1].rows.length === 17, 'Excel Passages : lignes : ' + JSON.stringify(xp[0].rows.slice(0, 6)));
await pc.click('#ep-export-pdf'); await pc.waitForTimeout(300);
const pdf2 = await pc.evaluate(() => window.__fich.find(f => f.mime === 'application/pdf'));
eq(pdf2.nom, 'echographies_passage_2026-08-01.pdf', 'PDF Passages : nom');
L = lirePdf(pdf2.b64); TXT = L.txt.join('\n');
for (const motif of ['Échographies · passages', 'Passage du 01-08-2026', 'Par lot · le 01-08-2026', 'Brebis du passage · Toutes', 'Écho précédente', 'Ovilog — Échographies · passages'])
  check(TXT.includes(motif), 'PDF Passages contient « ' + motif + ' »');
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'les exports n\'écrivent rien');
console.log('OK 11 Exports : Aujourd\'hui et Passages, Excel et PDF charte, aucune écriture.');
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ÉCRAN PC ÉCHOGRAPHIES SONT PASSÉS.');
