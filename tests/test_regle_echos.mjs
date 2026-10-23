/* Règle « résultat de la dernière écho figé » (Accueil PC, Accueil mobile, écran Échographies PC) : le résultat se calcule sur les échos enregistrées quel que soit le statut actuel de la brebis (vendue, morte,
   perdue...) ; « Vide définitive » reste exclue de Pleine et de Vide (3e chiffre) ; seules les listes « À repasser à l'écho » et « Sans échographie » ne gardent que les brebis présentes.
   Non-régression : une brebis vide vendue ou morte après l'écho reste comptée dans Vide et disparaît de « À repasser ». Même noyau sur les trois écrans. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (n) => '25000001298' + String(n).padStart(4, '0');
  let k = 0;
  const fiche = (id, o) => Object.assign({ id, eid: eid(++k), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const e = (type, stade, o) => Object.assign({ date: '2026-08-01', campagne: 2026, type, stade }, o || {});
  const vendue = () => ({ statut: 'vendue', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', date: '2026-09-10' }] });
  const morte = () => ({ statut: 'morte', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Morte', cause: 'Pneumonie', date: '2026-09-12' }] });
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; DB.casParticuliers = ['Avortée', 'Pseudogestation'];
  DB.brebis = [
    fiche('P', { echographies: [e('constat', 'Pleine')] }),                                                          // pleine, présente
    fiche('PV', Object.assign({ echographies: [e('constat', 'Pleine')] }, vendue())),                                // pleine, vendue après l'écho
    fiche('V1', { echographies: [e('constat', 'Vide')] }),                                                           // vide, présente -> « à repasser »
    fiche('V2', Object.assign({ echographies: [e('constat', 'Vide')] }, vendue())),                                  // vide, vendue après l'écho
    fiche('V3', Object.assign({ echographies: [e('constat', 'Vide')] }, morte())),                                   // vide, morte après l'écho
    fiche('VD', Object.assign({ echographies: [e('constat', 'Vide')], videesDefinitives: [{ campagne: 2026, date: '2026-09-01' }] }, vendue())),   // vide définitive, vendue ensuite
    fiche('AV', Object.assign({ echographies: [e('stade', null, { special: 'Avortée' })] }, morte())),               // avortée, morte
    fiche('SE', vendue()),                                                                                           // sortie, aucune écho : comptée nulle part
    fiche('SP', {})];                                                                                                // présente, aucune écho : « Sans échographie »
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
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
const pc = await ouvrir(true), mob = await ouvrir(false);
const comptes = (R) => ({ total: R.total, pleine: R.pleine, vide: R.vide, videDef: R.videDefinitive, cas: R.cas, sans: R.sans, aRepasser: R.videAPasser });

// ================================================================ 1. noyau : toutes les brebis ayant une écho, quel que soit leur statut
const A = await pc.evaluate(() => repartitionEchoAccueil());
eq(comptes(A), { total: 8, pleine: 2, vide: 3, videDef: 1, cas: 1, sans: 1, aRepasser: 1 }, 'Accueil : pleines 2 (dont 1 vendue), vides 3 (dont 1 vendue et 1 morte), vide définitive 1 (vendue), avortée 1 (morte), sans écho 1 (la sortie sans écho n\'est pas comptée), à repasser 1');
eq(await pc.evaluate(() => echoReussite(repartitionEchoAccueil())), 40, 'Réussite = pleines ÷ (pleines + vides) = 2 / 5 : la vide définitive n\'y entre pas');
const D = await pc.evaluate(() => { const d = donneesEchosPc({}); return { R: d.R, lignes: d.lignes.map(r => [r.id, r.cat, r.present, r.statutLib]) }; });
eq(comptes(D.R), comptes(A), 'écran Échographies PC = Accueil (même noyau, mêmes chiffres)');
eq(D.lignes.filter(l => !l[2]).map(l => [l[0], l[1], l[3]]).sort(), [['AV', 'cas', 'Morte'], ['PV', 'pleine', 'Vendue'], ['V2', 'vide', 'Vendue'], ['V3', 'vide', 'Morte'], ['VD', 'videDef', 'Vendue']], 'le détail inclut les brebis sorties (statut Vendue / Morte)');
check(!D.lignes.some(l => l[0] === 'SE'), 'une brebis sortie sans écho n\'apparaît nulle part');
console.log('OK 1 noyau : résultat figé sur toutes les brebis échographiées, Vide définitive séparée, sans écho = présentes seulement.');

// ================================================================ 2. non-régression : une brebis vide vendue ou morte APRÈS l'écho reste dans Vide, disparaît de « À repasser »
await pc.evaluate(() => { const s = DB.brebis.find(x => x.id === 'V1'); s.mouvements.push({ type: 'Vente', date: '2026-09-20' }); recalculerStatutBrebis(s); });
const A2 = await pc.evaluate(() => repartitionEchoAccueil());
eq([A2.vide, A2.videAPasser, A2.total, A2.pleine], [3, 0, 8, 2], 'V1 vendue après son écho : Vide reste à 3 (résultat figé), « À repasser » passe de 1 à 0');
await pc.evaluate(() => { const s = DB.brebis.find(x => x.id === 'P'); s.mouvements.push({ type: 'Morte', cause: 'Mammite', date: '2026-09-25' }); recalculerStatutBrebis(s); });
eq(await pc.evaluate(() => { const R = repartitionEchoAccueil(); return [R.pleine, R.vide, R.videAPasser]; }), [2, 3, 0], 'une pleine morte ensuite reste dans Pleine');
console.log('OK 2 non-régression : une brebis vide vendue ou morte après l\'écho reste comptée dans Vide et disparaît de « À repasser ».');

// ================================================================ 3. les trois écrans montrent les mêmes nombres
await pc.evaluate(jeu);
await pc.evaluate(() => { echosPcEtat = { onglet: 'resultats', F: echoFiltresPcVides(), q: '', fRes: '', fCompt: '', nb: 20, histoDate: '' }; render('echo-rapide'); });
const tuilesPc = await pc.evaluate(() => [...document.querySelectorAll('.ep-tuile')].map(t => [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent, t.querySelector('.ep-ts').textContent]));
eq(tuilesPc.slice(0, 3), [['Pleines', '2', '25 % des brebis'], ['Vides', '3', '1 à repasser à l\'écho'], ['Vides définitives', '1', 'campagne 2027']], 'écran Échographies PC : tuiles (vides = 3, dont 1 seule à repasser)');
check(await pc.evaluate(() => /Vendue/.test(document.getElementById('ep-detail-corps').textContent) && /Morte/.test(document.getElementById('ep-detail-corps').textContent)), 'écran Échographies PC : pastilles de statut des brebis sorties dans le détail');
await mob.evaluate(() => render('home'));
const cm = await mob.evaluate(() => [...document.querySelectorAll('.rp')].map(r => r.querySelector('span').textContent.trim() + ' ' + r.querySelector('b').textContent.trim()));
check(cm.some(x => /^Pleine 2 /.test(x)) && cm.some(x => /^Vide 3 /.test(x)) && cm.some(x => /^Vide définitive 1 /.test(x)), 'Accueil mobile : mêmes chiffres (Pleine 2, Vide 3, Vide définitive 1) : ' + JSON.stringify(cm));
check(await pc.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture');
console.log('OK 3 Accueil mobile, écran PC (et noyau de l\'Accueil PC) : mêmes chiffres.');

await browser.close();
console.log('\nTOUS LES TESTS DE LA RÈGLE « RÉSULTAT DE LA DERNIÈRE ÉCHO FIGÉ » SONT PASSÉS.');
