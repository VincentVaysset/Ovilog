/* Cellules par brebis (suivi CLS) : import PC (modèle Excel « Cellules » : N° brebis, N° d'échantillon, Cellules), date « pendant un contrôle » ou
   « hors contrôle », unité choisie à chaque import (cellules / milliers), brebis retrouvée par la recherche commune des imports (n° de travail,
   n° de travail complet, n° d'ordre, EID ; carte « Brebis à retrouver » : n° tapé, Associer), « Remplacer » seulement coché, ligne mal remplie
   laissée de côté, rien d'écrit avant « Importer ». Affichage : fiche › Contrôles (sous le contrôle du jour, ligne à part hors contrôle, pastille
   « cellules hautes »), seuil de compte (800 000 par défaut, Règles d'élevage › Lait), écran Contrôle laitier PC et mobile (colonne, filtre au seuil
   changeable, lot de recherche), exports Excel / PDF, Chantier de tri › Lots (PC) › Contrôles. saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1100 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-04-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', typeSuivi: 'cls' });
    const fiche = (ordre, court) => ({ id: 'b' + ordre, eid: '2500000045' + ordre, numeroCourtTravailSieol: court || undefined, statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], modesRepro: [], videesDefinitives: [],
      mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], agnelages: [{ date: '2026-11-20', campagne: 2026, codeRepro: 'MN', lambs: [] }],
      controleLaitier: [{ campagne: 2026, controle: 1, date: '2027-02-12', quantite: 1650 }, { campagne: 2026, controle: 2, date: '2027-03-14', quantite: 1420 }] });
    DB.brebis = [fiche('51074', '574'), fiche('51071', '571'), fiche('51088', '588'), fiche('51087'), fiche('51090', '590'), fiche('55090', '590')];
    DB.brebis[2].cellules = [{ date: '2027-03-14', campagne: 2026, cellules: 640000, controle: 2, source: 'import' }];   // 588 : déjà un échantillon au C2
    DB.beliers = []; DB.agnelles = []; DB.lots = [];
  });
  return page;
}
const xlsx = (page, rows) => page.evaluate(async r => Array.from(await buildXlsxWorkbook([{ name: 'Cellules', rows: [['N° brebis', 'N° d\'échantillon', 'Cellules']].concat(r) }])), rows);
const lignes = page => page.evaluate(() => [...document.querySelectorAll('#import-cel-table tbody tr')].map(tr => [tr.cells[0].textContent, tr.cells[3].textContent.replace(/ /g, ' '), tr.dataset.etat]));
const cel = (page, id) => page.evaluate(i => JSON.parse(JSON.stringify(DB.brebis.find(b => b.id === i).cellules || [])), id);

// ================================================================ 1. règles de base
const p = await ouvrir(true);
eq(await p.evaluate(() => [seuilCellules(), texteCellules(1250000).replace(/ /g, ' '), lireNombreCellules('800 000'), lireNombreCellules('abc'), valeurCellulesImport('5', 'milliers'), valeurCellulesImport('1 250', 'cellules'), valeurCellulesImport('1,5', 'milliers'), valeurCellulesImport('x', 'cellules'), datesControlesCampagne(2026)]),
  [800000, '1 250 000', 800000, null, 5000, 1250, 1500, null, [{ controle: 1, date: '2027-02-12' }, { controle: 2, date: '2027-03-14' }]],
  'seuil 800 000 par défaut, nombres lus avec espaces, unité milliers (5 = 5 000), contrôles de la campagne et leur date');
console.log('OK 1 : seuil par défaut, lecture des nombres et des unités, dates des contrôles.');

// ================================================================ 2. import : aperçu, unité obligatoire, brebis retrouvées / à choisir / à retrouver, conflit, ligne mal remplie
await p.evaluate(() => render('import-cellules'));
check(await p.evaluate(() => document.querySelector('#import-cel-controle').value === '2'), 'pendant un contrôle : le dernier contrôle de la campagne est proposé (C2 · 14-03-2027)');
await p.setInputFiles('#import-cel-file', { name: 'cel.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await xlsx(p, [
  ['574', '101', '1850'], ['FR 000045 51071', '102', '320'], ['588', '104', '610'], ['6087', '112', '1250'], ['590', '131', '420'], ['', '133', '200'], ['51071', '134', ''], ['574', '135', '900']])) });
await p.waitForSelector('#import-cel-table');
check(await p.isVisible('#import-cel-manque') && await p.isDisabled('#btn-confirm-import-cel'), 'sans unité choisie : message, « Importer » désactivé (aucun choix d\'office)');
await p.click('#import-cel-unite .opt-btn[data-val="milliers"]');
eq(await lignes(p), [['574', '1 850 000', 'nouveau'], ['571', '320 000', 'nouveau'], ['588', '610 000', 'conflit'], ['6087', '1 250 000', 'aRetrouver'], ['590', '420 000', 'aChoisir'], ['—', '200 000', 'invalide'], ['51071', '—', 'invalide'], ['574', '900 000', 'doublon']],
  'aperçu : n° de travail et EID retrouvés, 588 déjà un échantillon ce jour, 6087 à retrouver, 590 à choisir (deux brebis), lignes sans n° / sans cellules et doublon laissés de côté');
check(await p.evaluate(() => !!document.querySelector('#import-cel-table tr[data-etat="nouveau"] .pc-pill, #import-cel-table tr[data-etat="nouveau"] [class*="pill"]')), 'pastille « au-dessus » du seuil dans l\'aperçu (1 850 000)');
eq(await p.evaluate(() => window.__saves), 0, 'rien n\'est écrit pendant l\'aperçu');
// à retrouver : taper le n° d'ordre puis Associer (Entrée) ; à choisir : bouton de la brebis
await p.fill('.rt-champ', '51087'); await p.press('.rt-champ', 'Enter');
await p.click('.rt-choisir[data-eid="250000004555090"]');
await p.check('.import-cel-remplacer');
eq((await lignes(p)).map(l => l[2]), ['nouveau', 'nouveau', 'remplace', 'nouveau', 'nouveau', 'invalide', 'invalide', 'doublon'], 'brebis associée à la main, à choisir tranchée, « Remplacer » coché');
check(/Importer 5 échantillons/.test(await p.textContent('#btn-confirm-import-cel')), 'bouton « Importer 5 échantillons »');
await p.click('#btn-confirm-import-cel');
eq(await cel(p, 'b51074'), [{ date: '2027-03-14', campagne: 2026, cellules: 1850000, source: 'import', controle: 2, echantillon: '101' }], '574 : échantillon du C2, en cellules/mL, n° d\'échantillon gardé');
eq((await cel(p, 'b51088')).map(e => e.cellules), [610000], '588 : échantillon du jour remplacé (un seul par jour)');
eq((await cel(p, 'b51087')).map(e => e.cellules), [1250000], 'brebis associée à la main : importée');
eq((await cel(p, 'b55090')).map(e => e.cellules), [420000], 'brebis choisie parmi deux : importée');
eq(await cel(p, 'b51090'), [], 'l\'autre 590 : rien');
eq(await p.evaluate(() => DB.brebis.find(b => b.id === 'b51087').numeroCourtTravailSieol), '6087', 'n° du fichier retenu sur la brebis associée à la main (retrouvée seule au prochain import)');
check(/5 échantillons de cellules importés/.test(await p.textContent('#import-cel-ok')), 'message de fin d\'import');
// hors contrôle, en cellules : 571 deux fois dans la campagne
await p.click('#import-cel-mode .opt-btn[data-val="hors"]');
await p.fill('#import-cel-date', '2027-04-02'); await p.dispatchEvent('#import-cel-date', 'change');
await p.setInputFiles('#import-cel-file', { name: 'cel2.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await xlsx(p, [['571', '', '540000']])) });
await p.waitForSelector('#import-cel-table');
await p.click('#import-cel-unite .opt-btn[data-val="cellules"]');
await p.click('#btn-confirm-import-cel');
eq((await cel(p, 'b51071')).map(e => [e.date, e.cellules, e.controle || null]), [['2027-03-14', 320000, 2], ['2027-04-02', 540000, null]], 'hors contrôle : date tapée, sans n° de contrôle, unité « cellules » telle quelle');
console.log('OK 2 : import (unité obligatoire, retrouver / choisir / associer, Remplacer coché, lignes mal remplies, hors contrôle).');

// ================================================================ 3. fiche, seuil, écran Contrôle laitier PC, exports, Lots PC
await p.evaluate(() => { currentSheepId = 'b51071'; ficheBrebisTabSheepId = 'b51071'; ficheBrebisTab = 'ctrl'; render('detail', 'b51071'); });
eq(await p.evaluate(() => [...document.querySelectorAll('.cl-echantillon-fiche')].map(x => x.innerText.replace(/\s+/g, ' ').trim())), ['Échantillon du 02-04-2027 hors contrôle 540 000 cell./mL'], 'fiche : échantillon hors contrôle sur sa ligne, à sa date');
check(/cellules 320 000/.test((await p.textContent('#app')).replace(/ /g, ' ')), 'fiche : cellules sous le contrôle du même jour (C2)');
check(!(await p.$('.cl-cellules-hautes')), 'fiche : 540 000 sous le seuil, pas de pastille');
await p.evaluate(() => { parametresTab = 'regles'; render('parametres'); });
await p.fill('#f-seuil-cellules', '500 000'); await p.click('#btn-save-seuil-cellules');
eq(await p.evaluate(() => DB.seuilCellules), 500000, 'seuil réglé dans Règles d\'élevage › Lait (réglage de compte)');
await p.evaluate(() => { currentSheepId = 'b51071'; ficheBrebisTab = 'ctrl'; render('detail', 'b51071'); });
check(!!(await p.$('.cl-cellules-hautes')), 'fiche : au-dessus du nouveau seuil, pastille « cellules hautes »');
await p.evaluate(() => render('controle-laitier'));
const valsPc = () => p.evaluate(() => [...document.querySelectorAll('#cl-table tr')].slice(1).map(tr => [tr.cells[1].textContent, tr.querySelector('.cl-cellules') ? tr.querySelector('.cl-cellules').textContent.replace(/ /g, ' ') : null]));
eq((await valsPc()).filter(r => r[1] !== '—'), [['571', '540 000'], ['574', '1 850 000'], ['6087', '1 250 000'], ['588', '610 000'], ['590', '420 000']], 'Contrôle laitier PC : colonne « Cellules » = dernier échantillon de la campagne');
await p.click('#btn-cl-filtre-cellules');
eq((await valsPc()).map(r => r[0]), ['571', '574', '6087', '588'], 'filtre « Cellules au-dessus de » : seuil du compte proposé (500 000)');
await p.fill('#f-seuil-cellules-cl', '1 000 000');
eq((await valsPc()).map(r => r[0]), ['574', '6087'], 'seuil changé pour ce tri seulement');
eq(await p.evaluate(() => DB.seuilCellules), 500000, 'le réglage du compte ne change pas');
await p.evaluate(() => { window.__xl = []; window.__pdf = []; buildXlsxWorkbook = async (f) => { window.__xl.push(JSON.parse(JSON.stringify(f))); return new Uint8Array([1]); }; const b = buildPdfTableCharte; buildPdfTableCharte = o => { window.__pdf.push({ title: o.title, columns: o.columns.map(c => c.label), rows: o.rows, tuiles: (o.tuiles || []).map(t => t.label + ' ' + t.valeur) }); return b(o); }; saveOrShareBinaryFile = async () => {}; });
await p.click('#btn-cl-export-xlsx'); await p.waitForFunction(() => window.__xl.length === 1);
eq(await p.evaluate(() => window.__xl[0][0].rows), [['N° de travail', 'Date de mise bas', 'C1 (mL)', 'C2 (mL)', 'Cellules'], ['574', '20-11-2026', 1650, 1420, 1850000], ['6087', '20-11-2026', 1650, 1420, 1250000]], 'Export Excel : colonne « Cellules » en fin, suit le filtre');
await p.click('#btn-cl-export-pdf'); await p.waitForFunction(() => window.__pdf.length === 1);
eq(await p.evaluate(() => { const x = window.__pdf[0]; return [x.title, x.columns, x.rows.map(r => r[r.length - 1]), x.tuiles]; }),
  ['Contrôle laitier · cellules au-dessus de 1 000 000', ['N° de travail', 'Date de mise bas', 'C1 (mL)', 'C2 (mL)', 'Cellules'], ['1 850 000', '1 250 000'], ['Cellules au-dessus de 500 000 2', 'Brebis 2']],
  'Export PDF : titre du filtre, colonne « Cellules », tuile des brebis au-dessus du seuil');
// Lots PC › Contrôles
await p.evaluate(() => { DB.lots = []; DB.evenementsLots = []; lotsPcEtat = null; render('lots'); });
await p.click('#lt-type .opt-btn[data-val="recherche"]');
await p.fill('#lt-nom', 'Lot classique'); await p.waitForTimeout(400);
await p.click('#lt-creer'); await p.waitForSelector('#lt-table');
await p.click('#lt-onglets .opt-btn[data-val="controles"]');
await p.waitForSelector('#lt-cel-min');
await p.fill('#lt-cel-min', '1 000 000'); await p.waitForTimeout(500);
eq(await p.evaluate(() => [...document.querySelectorAll('td.lt-cellules')].map(td => td.closest('tr').querySelector('.num-fixe').textContent + ' ' + td.textContent.replace(/ /g, ' '))), ['574 1 850 000', '6087 1 250 000'], 'Lots PC › Contrôles : filtre « Cellules au-dessus de » et colonne « Cellules »');
console.log('OK 3 : fiche, seuil de compte, Contrôle laitier PC (colonne, filtre, seuil du tri), exports, Lots PC.');
await p.context().close();

// ================================================================ 4. mobile : cartes, filtre, lot de recherche ; sans échantillon, rien ne change
const m = await ouvrir(false);
await m.evaluate(() => { DB.brebis[0].cellules = [{ date: '2027-03-14', campagne: 2026, cellules: 1850000, controle: 2, source: 'import' }]; render('controle-laitier'); });
check(/Cellules · 14-03-2027/.test(await m.textContent('#cl-table')), 'mobile : ligne « Cellules · date » sur la carte');
await m.click('#btn-cl-filtre-cellules');
eq(await m.evaluate(() => [...document.querySelectorAll('#cl-table .cl-num')].map(x => x.textContent)), ['574'], 'mobile : filtre au seuil de 800 000 (588 à 640 000 en dessous)');
await m.click('#btn-cl-toggle-all');
check(!(await m.isDisabled('#btn-cl-create-lot')), 'mobile : « Tout cocher » puis « Créer un lot de recherche » (lot à chercher en bergerie ou en salle de traite)');
await m.evaluate(() => { DB.brebis.forEach(b => { delete b.cellules; }); render('controle-laitier'); });
check(!(await m.$('#btn-cl-filtre-cellules')) && !/Cellules ·/.test(await m.textContent('#cl-table')), 'sans échantillon dans la campagne : ni filtre ni ligne Cellules');
await m.context().close();
await browser.close();
console.log('test_cellules_cls : OK');
