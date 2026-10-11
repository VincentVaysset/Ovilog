/* Accueil MOBILE « Mon troupeau » (maquette « Accueil mobile ») : 3 tuiles de la charte (Brebis vert, Agnelles ambre, Béliers bleu) avec leurs liens vers les listes, carte « Mises bas »
   (titre + pastille %, « N sur M brebis », barre, Restantes / Prolificité / Agneaux nés, mort-nés · mâles / femelles), section « À surveiller » (Attendues à la traite, Sous délai d'attente,
   Bilan de campagne) avec pastilles grises à 0 et colorées au-dessus (bleue / rouge), « Dernière échographie » (Résultat / Comptage) et « Contrôle laitier · moyenne par contrôle ». Mêmes données,
   mêmes calculs, aucune écriture à l'affichage. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

function jeu(mode) {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.EID = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { Intramicine: { posologie: null, delaiAttente: 7, delaiLait: 7, delaiViande: 28 } };
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = []; DB.beliers = []; DB.agnelles = []; DB.brebis = [];
  if (mode !== 'zero') {
    const nais = { type: 'Entrée', cause: 'Naissance', date: '2026-09-25' };
    const A = fiche(eid(8, 133), { id: 'A', numeroCourtTravailSieol: '8133' });      // mise bas : 2 agneaux + 1 mort-né, 2 en attente
    A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 801), sexe: 'Mâle', sanitaire: [], mouvements: [nais] }, { eid: eid(6, 802), sexe: 'Femelle', sanitaire: [], mouvements: [nais] }, { sexe: 'Mort-né', sanitaire: [], mouvements: [] }] }];
    const E = fiche(eid(9, 152), { id: 'E' });                                         // attendue à la traite : tous ses agneaux sont partis
    E.agnelages = [{ date: '2026-09-20', campagne: 2026, lambs: [{ eid: eid(6, 810), sexe: 'Mâle', sanitaire: [], statutFinal: 'vendu', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-20' }, { type: 'Vendu', acheteur: 'X', date: '2026-10-01' }] }] }];
    const S = fiche(eid(7, 5), { id: 'S', sanitaire: [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, intervenant: 'Éleveur', dureeJours: 1, bio: false }] });   // sous délai
    DB.brebis = [A, E, S, fiche(eid(9, 59), { id: 'B' }), fiche(eid(0, 33), { id: 'C' }),
      fiche(eid(9, 99), { id: 'M', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Natera', date: '2026-09-01' }] })];
    DB.beliers = [fiche(eid(9, 90), { id: 'bel1', statut: 'actif' }), fiche(eid(8, 91), { id: 'bel2', statut: 'actif' }), fiche(eid(9, 92), { id: 'bel3', statut: 'vendu', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente reproduction', acheteur: 'Bio Plus', date: '2026-10-02' }] })];
    DB.agnelles = [fiche(eid(5, 41), { id: 'ag1' }), fiche(eid(5, 42), { id: 'ag2' }), fiche(eid(5, 43), { id: 'ag3' })];
  }
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau, mode) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(`window.__jeu = ${jeu.toString()}`);
  await page.evaluate(jeu, mode || '');
  return page;
}
const m = await ouvrir(false);
await m.evaluate(() => render('home'));

// ================================================================ 1. les trois tuiles
const t = await m.evaluate(() => ({
  tuiles: [...document.querySelectorAll('.ac-tuile')].map(e => [e.id, e.querySelector('.reg-tuile-l').textContent, e.querySelector('.reg-tuile-v').textContent, e.className.replace(/ ?(reg-tuile|ac-tuile) ?/g, ' ').trim(), getComputedStyle(e).backgroundColor, getComputedStyle(e).borderLeftColor, getComputedStyle(e.querySelector('.reg-tuile-v')).color]),
  ronds: document.querySelectorAll('#app .icon-circle, #app .home-hero, #app .stat-pill, #app .stat-card').length,
  attendu: [DB.brebis.filter(s => (s.statut || 'active') === 'active').length, DB.agnelles.length, DB.beliers.filter(b => (b.statut || 'actif') === 'actif').length]
}));
eq(t.tuiles.map(x => x.slice(0, 3)), [['ac-tuile-brebis', 'Brebis', String(t.attendu[0])], ['ac-tuile-agnelles', 'Agnelles', String(t.attendu[1])], ['ac-tuile-beliers', 'Béliers', String(t.attendu[2])]], 'tuiles : libellés et chiffres (brebis actives, agnelles, béliers actifs)');
eq(t.attendu, [5, 3, 2], 'chiffres du jeu');
eq(t.tuiles.map(x => x.slice(3)), [['vert', 'rgb(227, 243, 230)', 'rgb(47, 110, 68)', 'rgb(47, 110, 68)'], ['ambre', 'rgb(251, 238, 215)', 'rgb(181, 112, 28)', 'rgb(181, 112, 28)'], ['bleu', 'rgb(230, 240, 250)', 'rgb(31, 90, 138)', 'rgb(31, 90, 138)']], 'couleurs de la charte : pastel, filet, chiffre (vert, ambre, bleu)');
eq(t.ronds, 0, 'plus de gros ronds avec icônes ni de blocs d\'ancien style');
for (const [id, vue] of [['ac-tuile-brebis', 'list'], ['ac-tuile-agnelles', 'agnelles-inventaire'], ['ac-tuile-beliers', 'beliers']]) {
  await m.evaluate(() => render('home')); await m.click('#' + id);
  eq(await m.evaluate(() => currentView), vue, 'lien de la tuile ' + id);
}
console.log('OK 1 tuiles : chiffres, couleurs de la charte, liens vers les listes.');

// ================================================================ 2. carte « Mises bas »
await m.evaluate(() => render('home'));
const mb = await m.evaluate(() => { const d = dashboardStatsData(); const c = document.getElementById('ac-mises-bas'); return {
  titre: c.querySelector('.ac-titre').textContent, pastille: c.querySelector('.reg-pastille').textContent, gros: c.querySelector('.ac-big').textContent, sur: c.querySelector('.ac-sur').textContent, barre: c.querySelector('.ac-barre i').style.width,
  stats: [...c.querySelectorAll('.ac-stats div')].map(x => [x.querySelector('b').textContent, x.querySelector('span').textContent]), info: c.querySelector('.reg-info').textContent,
  attendu: { mb: d.misesBasActives, sur: d.troupeauAMettreBas, pct: d.pctMisesBasRealisees, rest: d.misesBasRestantes, prol: d.prolificite, nes: d.totalAgneaux, mn: d.totalMortNes, m: d.totalMales, f: d.totalFemelles, tmb: d.totalMisesBas } }; });
const a = mb.attendu;
eq([mb.titre, mb.pastille, mb.gros, mb.sur, mb.barre], ['Mises bas', a.pct + ' %', String(a.mb), 'sur ' + a.sur + ' brebis', a.pct + '%'], 'titre, pastille %, « N sur M brebis », barre : mêmes valeurs que dashboardStatsData');
eq(mb.stats, [[String(a.rest), 'Restantes'], [a.prol.toFixed(2).replace('.', ','), 'Prolificité'], [String(a.nes), 'Agneaux nés']], 'Restantes / Prolificité (virgule) / Agneaux nés');
eq(mb.info, a.mn + ' mort-né(s) · ' + a.m + ' mâle(s) / ' + a.f + ' femelle(s)', 'ligne mort-nés · mâles / femelles');
check(a.mb === 2 && a.nes === 4 && a.mn === 1 && a.tmb === 2, 'jeu : 2 mises bas, 4 nés dont 1 mort-né : ' + JSON.stringify(a));
console.log('OK 2 carte Mises bas : mêmes chiffres, prolificité avec virgule.');

// ================================================================ 3. « À surveiller » : ordre, pastilles grises à 0 / colorées au-dessus, liens
const sv = await m.evaluate(() => ({ sec: document.querySelector('.ac-sec').textContent, lignes: [...document.querySelectorAll('.ac-rw')].map(r => [r.id, r.querySelector('.ac-a').textContent, (r.querySelector('.ac-b') || {}).textContent || null, r.querySelector('.ac-cnt') ? r.querySelector('.ac-cnt').textContent + ':' + r.querySelector('.ac-cnt').className.replace('ac-cnt ', '') : null, !!r.querySelector('.bc-chev')]) }));
eq(sv.sec, 'À surveiller', 'section');
eq(sv.lignes, [['kpi-attendues-traite', 'Attendues à la traite', 'Tous leurs agneaux sont partis', '1:bleu', true], ['kpi-sous-delai', 'Sous délai d\'attente', 'Traitement lait en cours', '1:rouge', true], ['kpi-bilan-campagne', 'Bilan campagne 2027', null, null, true]], 'lignes : titre, sous-titre, pastille (bleue / rouge si > 0), chevron ; Bilan sans pastille');
const css = await m.evaluate(() => [...document.querySelectorAll('.ac-cnt')].map(e => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color]));
eq(css, [['rgb(230, 240, 250)', 'rgb(31, 90, 138)'], ['rgb(251, 227, 224)', 'rgb(163, 58, 49)']], 'pastille bleue pour Attendues, rouge pour Sous délai');
check(await m.evaluate(() => document.querySelectorAll('.ac-rw').length === 3 && document.querySelectorAll('.stat-card-wide').length === 0), 'plus aucun bloc rouge ou pastel en grand');
console.log('OK 3 À surveiller : lignes, pastilles bleue / rouge au-dessus de 0.');
check(await m.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'l\'affichage de l\'accueil n\'écrit rien');
await m.click('#kpi-sous-delai'); eq(await m.evaluate(() => currentView), 'sous-delai', 'lien Sous délai d\'attente');
await m.evaluate(() => render('home')); await m.click('#kpi-bilan-campagne'); eq(await m.evaluate(() => currentView), 'bilan-campagne', 'lien Bilan de campagne');
await m.evaluate(() => render('home')); await m.click('#kpi-attendues-traite');
eq(await m.evaluate(() => [currentView, currentLotId, DB.lots.length && DB.lots[0].membres.length]), ['lot-search', 'auto-attendues-traite', 1], 'lien Attendues à la traite : ouvre le lot automatique comme avant (écriture existante, inchangée)');
console.log('OK 3bis liens des trois lignes.');

// ================================================================ 4. tout à 0 : pastilles grises ; prolificité « — »
await m.evaluate(jeu, 'zero'); await m.evaluate(() => render('home'));
const z = await m.evaluate(() => ({ cnt: [...document.querySelectorAll('.ac-cnt')].map(e => e.textContent + ':' + e.className.replace('ac-cnt ', '') + ':' + getComputedStyle(e).backgroundColor), prol: document.querySelectorAll('.ac-stats b')[1].textContent, tuiles: [...document.querySelectorAll('.ac-tuile .reg-tuile-v')].map(e => e.textContent), pct: document.querySelector('#ac-mises-bas .reg-pastille').textContent }));
eq(z.cnt, ['0:gris:rgb(239, 233, 218)', '0:gris:rgb(239, 233, 218)'], 'pastilles grises à 0');
eq([z.prol, z.tuiles, z.pct], ['—', ['0', '0', '0'], '0 %'], 'prolificité « — » sans mise bas, tuiles à 0');
console.log('OK 4 tout à 0 : pastilles grises, prolificité « — ».');

// ================================================================ 5. « Dernière échographie » : règle (écho postérieure à la dernière mise bas), Résultat / Comptage
function jeuEcho() {
  window.__jeu('zero');
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (id, o) => Object.assign({ id, eid: eid(8, Number(id.replace(/\D/g, '')) || 1), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const e = (date, o) => Object.assign({ date, campagne: 2026 }, o);
  const mb = (date) => [{ date, campagne: 2026, lambs: [{ eid: eid(6, 999), sexe: 'Mâle', sanitaire: [], mouvements: [] }] }];
  DB.brebis = [
    fiche('P1', { echographies: [e('2026-08-01', { type: 'stade', stade: 'Début', agneaux: 'Simple' })] }),
    fiche('P2', { echographies: [e('2026-08-01', { type: 'stade', stade: 'Milieu', agneaux: 'Double' })] }),
    fiche('P3', { echographies: [e('2026-08-01', { type: 'stade', stade: 'Fin', nombreAgneaux: 3 })] }),
    fiche('P4', { echographies: [e('2026-08-01', { type: 'stade', stade: 'IA', nombreAgneaux: 4 })] }),
    fiche('P5', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Pleine' })] }),
    fiche('V1', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Vide' })] }),
    fiche('VD', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Vide' })], videesDefinitives: [{ campagne: 2026, date: '2026-10-01' }] }),
    fiche('AV', { echographies: [e('2026-08-01', { type: 'stade', special: 'Avortée' })] }),
    fiche('PS', { echographies: [e('2026-08-01', { type: 'stade', special: 'Pseudogestation' })] }),
    fiche('MB', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Pleine' })], agnelages: mb('2026-09-25') }),                    // a mis bas depuis son écho : sans échographie
    fiche('MB2', { echographies: [e('2026-08-01', { type: 'stade', stade: 'Milieu', nombreAgneaux: 2 })], agnelages: mb('2026-06-01') }),   // écho postérieure à la mise bas : retenue
    fiche('TIE', { echographies: [e('2026-08-01', { type: 'constat', stade: 'Vide' }), e('2026-08-01', { type: 'stade', stade: 'Fin', agneaux: 'Simple' })] }),   // même date : la dernière saisie l'emporte
    fiche('T1', { echographies: [e('2026-07-01', { type: 'stade', stade: 'Milieu', agneaux: 'Double' }), e('2026-08-01', { type: 'constat', stade: 'Pleine' })] }),   // deux types : le constat, plus récent, l'emporte
    fiche('T2', { echographies: [e('2026-07-01', { type: 'constat', stade: 'Pleine' }), e('2026-08-01', { type: 'stade', stade: 'Fin', agneaux: 'Simple' })] }),
    fiche('N'),
    fiche('X', { statut: 'vendue', echographies: [e('2026-08-01', { type: 'constat', stade: 'Pleine' })] })];                                   // inactive : jamais comptée
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
await m.evaluate(jeuEcho); await m.evaluate(() => { accueilEchoTab = 'resultat'; render('home'); });
const lignesEcho = () => m.evaluate(() => [...document.querySelectorAll('#ac-echo .ac-echo-corps > *')].map(r => r.classList.contains('lbl') ? '# ' + r.textContent : r.querySelector('.h span').textContent + ' = ' + r.querySelector('.h b').textContent.replace(/\s/g, ' ') + ' [' + r.querySelector('.tb2 i').className + ']'));
eq(await m.evaluate(() => [...document.querySelectorAll('#ac-echo-seg button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : ''))), ['Résultat*', 'Comptage'], 'segmenté Résultat / Comptage, Résultat actif');
eq(await lignesEcho(), [
  'Pleine = 9 (60 %) [vert]', '# Monte naturelle', 'Début = 1 (7 %) [vert]', 'Milieu = 2 (13 %) [vert]', 'Fin = 3 (20 %) [vert]', '# Lot IA / Éponge', 'IA = 1 (7 %) [vert]', 'Retour 1 = 0 (0 %) [vert]', 'Retour 2 = 0 (0 %) [vert]', 'Tardive = 0 (0 %) [vert]',
  'Stade non précisé = 2 (13 %) [vert]', 'Vide = 1 (7 %) [rouge]', 'Vide définitive = 1 (7 %) [rouge-clair]', 'Avortée / pseudogestation = 2 (13 %) [ambre]', 'Sans échographie = 2 (13 %) [gris]'], 'Résultat : Pleine (Début, Milieu, Fin, lot IA, non précisé), Vide, Vide définitive, Avortée / pseudogestation, Sans échographie (15 brebis actives)');
eq(await m.evaluate(() => document.querySelector('#ac-echo .reg-info').textContent), 'Dernière écho postérieure à la dernière mise bas, toutes sessions confondues (constat, stade, avec ou sans comptage). Une brebis qui a mis bas depuis sa dernière écho passe en « Sans échographie ». Vide : à repasser à l\'écho ou à classer en vide définitive.', 'phrase d\'info du Résultat');
console.log('OK 5 Résultat : règle (écho postérieure à la dernière mise bas, date égale = dernière saisie, deux types = le plus récent), Vide définitive à part, Avortée / pseudogestation à part.');
await m.click('#ac-echo-seg [data-tab="comptage"]');
eq(await m.evaluate(() => [...document.querySelectorAll('#ac-echo-seg button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : ''))), ['Résultat', 'Comptage*'], 'Comptage actif');
eq(await lignesEcho(), ['1 agneau (simple) = 3 (33 %) [vert]', '2 agneaux (double) = 2 (22 %) [vert]', '3 agneaux et + = 2 (22 %) [vert]', 'Sans comptage = 2 (22 %) [gris]'], 'Comptage : brebis pleines, « 2 » = 2 + Double, « 3 et + » = 3 + 4 et plus');
eq(await m.evaluate(() => document.querySelector('#ac-echo .reg-info').textContent), 'Brebis pleines, selon le comptage de leur dernière échographie. « 2 » regroupe 2 et « 2 et plus » (Simple / Double) ; « 3 et + » regroupe 3 et « 4 et plus ».', 'phrase d\'info du Comptage');
check(await m.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'le segmenté est un état d\'affichage : aucune écriture');
eq(await m.evaluate(() => { const c = repartitionEchoAccueil(); return c.pleine + c.vide + c.videDefinitive + c.cas + c.sans === c.total; }), true, 'chaque brebis active est dans une seule ligne (somme = total)');
await m.evaluate(() => { accueilEchoTab = 'resultat'; });
console.log('OK 5bis Comptage : 1 / 2 / 3 et + / Sans comptage, aucune écriture.');
// jeu vide : aucun calcul n'échoue
await m.evaluate(jeu, 'zero'); await m.evaluate(() => { accueilEchoTab = 'resultat'; render('home'); });
eq((await lignesEcho())[0], 'Pleine = 0 (0 %) [vert]', 'aucune brebis : Pleine 0 (0 %)');

// ================================================================ 6. Contrôle laitier : moyenne et nombre de brebis par contrôle, plus de « relevés au total »
await m.evaluate(jeu, ''); await m.evaluate(() => {
  DB.resumeControleLaitier = [{ campagne: 2026, controle: 1, laitTroupeau: 2100, nbBrebis: 398 }, { campagne: 2026, controle: 2, laitTroupeau: 1800, nbBrebis: 391 }];
  render('home');
});
const cl = await m.evaluate(() => ({ titre: document.querySelector('#ac-controle-laitier .ac-titre').textContent, cols: [...document.querySelectorAll('#ac-controle-laitier .ac-cl div')].map(d => [d.querySelector('span').textContent, d.querySelector('b').textContent, d.querySelector('small').textContent]), texte: document.getElementById('app').textContent }));
eq(cl.titre, 'Contrôle laitier · moyenne par contrôle', 'titre');
eq(cl.cols, [['1er contrôle', '2,10 L', '398 brebis'], ['2e contrôle', '1,80 L', '391 brebis'], ['3e contrôle', '—', '0 brebis']], 'moyenne et nombre de brebis par contrôle (« — » et « 0 brebis » sans résumé)');
check(!/relevé\(s\) enregistré\(s\)/.test(cl.texte), 'plus de « relevés enregistrés au total »');
check(await m.evaluate(() => !/Répartition par stade/.test(document.getElementById('app').textContent)), 'plus d\'ancienne carte « Répartition par stade »');
console.log('OK 6 Contrôle laitier : moyenne et brebis par contrôle.');

// ================================================================ 7. PC : l'accueil PC ne change pas
const pc = await ouvrir(true);
await pc.evaluate(() => render('home'));
check(await pc.evaluate(() => document.querySelectorAll('.ac-tuile, .ac-carte, .ac-rw').length === 0 && !!document.getElementById('compteur-brebis-actives')), 'PC : l\'accueil PC garde son rendu');
console.log('OK 7 PC inchangé.');
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ACCUEIL MOBILE SONT PASSÉS.');
