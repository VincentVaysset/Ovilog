/* Refonte Production laitière, partie 4 : page PC « Production laitière » à deux onglets Tank / Qualité (même structure que le Bilan économique PC : titre, sélecteur de campagne et boutons
   en haut à droite, tuiles blanches, cartes côte à côte). Tank : tuiles, tableau « Litrage par mois » (total), clic mois -> relevés, clic relevé -> fiche (litres au clavier, case prélèvement,
   Enregistrer, Supprimer avec confirmation), « + Nouveau relevé » (date au clavier), aucun bouton d'import, aucun montant en euros. Qualité : bandeau positif, tuiles, « Moyennes par mois »,
   clic mois -> prélèvements avec toutes les analyses (cellules en milliers/mL) + Modifier, « + Nouveau prélèvement ». Exports = mêmes fonctions que le mobile, avec la campagne affichée.
   Aucune donnée d'une autre campagne. saveData REMPLACÉ ; jeu synthétique ; export réel en LECTURE SEULE. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-US' })).newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim() : null, sel);
const $$t = sel => page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim()), sel);
const nb = sel => page.evaluate(s => document.querySelectorAll(s).length, sel);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.laitTank = [
    { date: '2025-10-01', quantite: 200 }, { date: '2025-12-04', quantite: 300 }, { date: '2025-12-05', quantite: 310 }, { date: '2026-07-30', quantite: 130 }, { date: '2026-07-31', quantite: 120 },
    { date: '2026-09-30', quantite: 90 }, { date: '2026-10-01', quantite: 500 }, { date: '2026-10-02', quantite: 510 }];
  const pr = (date, vol, extra) => Object.assign({ id: 'p' + date, date, volumeLait: vol, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: null, salmonelles: null, campagne: campagneAnneeDebutPourDate(date) }, extra);
  DB.prelevementsQualite = [
    pr('2025-12-05', 310, { tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif' }),
    pr('2026-07-31', 120, { tb: 90, tp: 70, cellules: 300000, floreTotale: 10000, coliformes: 30, butyriques: 50, salmonelles: 'positif' }),
    pr('2026-10-02', 510)];
  DB.penalitesBacterio = [];
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  window.__saisies = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, n: bytes.length }); };
  plOnglet = 'tank'; plPcCampagne = null; plPcMoisTank = null; plPcDate = null; plPcMoisQual = null;
  render('qualite');
});
const ouvrir = (onglet, camp) => page.evaluate(([o, c]) => { plOnglet = o; plPcCampagne = c; plPcMoisTank = null; plPcDate = null; plPcMoisQual = null; render('qualite'); }, [onglet, camp]);
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-production .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.replace(/\s+/g, ' ').trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim()]])));

// ================================================================ 1. Tank : structure, tuiles, tableau, aucun import ni montant
await jeu();
check(await nb('#pc-production') === 1, 'page PC Production laitière affichée (pas la version mobile)');
eq(await $$t('#pl-onglets .tab-btn'), ['Tank', 'Qualité'], 'deux onglets');
eq(await $t('#pc-production .brd-title'), 'Tank', 'titre');
eq(await page.evaluate(() => [...document.querySelectorAll('#pc-production .brd-actions button')].map(b => b.textContent)), ['Excel', 'Tank (PDF)', 'Calendrier (PDF)'], 'boutons d\'action en haut à droite, aucun import');
check(await page.evaluate(() => !!document.querySelector('#pc-production .brd-actions select')), 'sélecteur de campagne en haut à droite');
check(!/[Ii]mporter/.test(await $t('#app')), 'aucun bouton d\'import du fichier tank');
check(!/€/.test(await $t('#app')), 'Tank PC : aucun montant en euros');
check(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(await $t('#app')), 'aucun emoji');
const dT = await page.evaluate(() => { const d = tankCampagneData(2026); return { titre: d.tuileMois.titre, litres: d.tuileMois.litres, total: d.total.litres, n: d.total.nbReleves, pointe: d.pointe }; });
let K = await kpis();
eq(Object.keys(K).map(k => k.toUpperCase()), ['MOIS EN COURS', 'CAMPAGNE 2027', 'RELEVÉS', 'MOIS DE POINTE'], 'quatre tuiles');
eq(K[Object.keys(K)[0]][0], '1 010 L', 'litrage du mois en cours (500 + 510)');
eq(K[Object.keys(K)[1]][0], '1 010 L', 'litrage de la campagne');
eq(K[Object.keys(K)[2]][0], '2', 'nombre de relevés');
eq(K[Object.keys(K)[3]][0], 'Octobre 2026', 'mois de pointe');
const cells = sel => page.evaluate(s => [...document.querySelectorAll(s + ' tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim())), sel);
eq(await cells('#pc-tank-mois'), [['Octobre 2026', '2', '1 010', '', '1 010'], ['Campagne 2027', '2', '1 010', '', '1 010']], 'tableau Litrage par mois : mois + ligne de total');
console.log('OK 1 Tank PC : onglets, titre, actions, 4 tuiles, tableau « Litrage par mois » avec total ; aucun import, aucun montant, aucun emoji.');

// ================================================================ 2. campagne passée : « Dernier mois », mois, relevés, fiche
await ouvrir('tank', 2025);
K = await kpis(); let ks = Object.keys(K);
eq(ks.map(k => k.toUpperCase()), ['DERNIER MOIS', 'CAMPAGNE 2026', 'RELEVÉS', 'MOIS DE POINTE'], 'campagne passée : tuile « Dernier mois »');
eq(await cells('#pc-tank-mois'), [['Octobre 2025', '1', '200', '', '200'], ['Décembre 2025', '2', '610', '', '810'], ['Juillet 2026', '2', '250', '', '1 060'], ['Septembre 2026', '1', '90', '', '1 150'], ['Campagne 2026', '6', '1 150', '', '1 150']], 'mois de la campagne 2026 uniquement (aucun relevé d\'octobre 2026)');
eq(K[ks[0]][0], '90 L', 'dernier mois = septembre 2026 (90 L)');
eq(await $t('#pc-tank-releves .brd-ttl'), 'Septembre 2026', 'relevés du dernier mois affichés à droite');
await page.click('.pc-mois-row[data-cle="2025-12"]');
eq(await $$t('#pc-tank-releves .pc-rel'), ['04-12-2025 300 L', '05-12-2025 Analyse310 L'], 'clic sur un mois : ses relevés, pastille Analyse sur le jour du prélèvement');
eq(await $t('#pc-releve-fiche .brd-ttl'), 'Relevé du 05-12-2025', 'dernier relevé du mois ouvert dans la fiche');
await page.click('.pc-rel[data-date="2025-12-04"]');
eq(await $t('#pc-releve-fiche .brd-ttl'), 'Relevé du 04-12-2025', 'clic sur un relevé : sa fiche');
check(await page.evaluate(() => document.getElementById('pc-rel-date').disabled && document.getElementById('pc-rel-qte').value === '300' && !document.getElementById('pc-rel-prelev').checked), 'fiche : date figée, litres 300, case décochée');
console.log('OK 2 campagne passée : « Dernier mois », tableau de la seule campagne, clic mois -> relevés, clic relevé -> fiche.');

// ================================================================ 3. modification au clavier, case prélèvement (créé SANS analyses), enregistrer
await page.fill('#pc-rel-qte', ''); await page.click('#pc-rel-qte'); await page.keyboard.type('333.5', { delay: 40 });
check(await page.evaluate(() => document.getElementById('pc-rel-qte').value === '333.5' && document.activeElement.id === 'pc-rel-qte'), 'litres tapés au clavier, focus conservé');
await page.click('#pc-rel-prelev'); await page.click('#pc-rel-save'); await page.waitForTimeout(100);
const r3 = await page.evaluate(() => ({ r: DB.laitTank.find(l => l.date === '2025-12-04'), p: DB.prelevementsQualite.find(x => x.date === '2025-12-04'), s: window.__saves }));
eq(r3.r, { date: '2025-12-04', quantite: 333.5 }, 'relevé modifié');
check(r3.p && r3.p.volumeLait === 333.5 && r3.p.tb === null && r3.p.cellules === null && r3.p.listeria === null && r3.s === 1, 'prélèvement créé sans analyses, un seul enregistrement : ' + JSON.stringify(r3));
eq(await $$t('#pc-tank-releves .pc-rel'), ['04-12-2025 Analyse333,5 L', '05-12-2025 Analyse310 L'], 'liste mise à jour (pastille Analyse)');
eq((await cells('#pc-tank-mois'))[1], ['Décembre 2025', '2', '643,5', '', '843,5'], 'tableau mis à jour');
await page.click('#pl-onglets [data-onglet="qualite"]');
await page.click('.pc-qmois-row[data-cle="2025-12"]');
check((await $$t('.pc-prelev')).some(x => x.includes('04-12-2025') && x.includes('résultats à saisir')), 'dans Qualité : mention « résultats à saisir »');
await page.click('#pl-onglets [data-onglet="tank"]');
console.log('OK 3 fiche relevé : litres au clavier, case prélèvement (sans analyses, « résultats à saisir » dans Qualité), tableau mis à jour.');

// ================================================================ 4. nouveau relevé : date au clavier, doublon, confirmation d'écrasement
await page.click('#pc-rel-nouveau');
eq(await $t('#pc-releve-fiche .brd-ttl'), 'Nouveau relevé', 'fiche de création');
await page.fill('#pc-rel-date', ''); await page.focus('#pc-rel-date'); await page.keyboard.type('12062025', { delay: 40 });
await page.click('#pc-rel-qte'); await page.keyboard.type('250', { delay: 40 });
check(await page.evaluate(() => document.getElementById('pc-rel-date').value === '2025-12-06' && document.getElementById('pc-rel-qte').value === '250'), 'date et litres tapés au clavier : ' + await page.evaluate(() => document.getElementById('pc-rel-date').value));
await page.click('#pc-rel-save'); await page.waitForTimeout(100);
eq(await page.evaluate(() => DB.laitTank.find(l => l.date === '2025-12-06')), { date: '2025-12-06', quantite: 250 }, 'nouveau relevé enregistré');
eq(await $t('#pc-releve-fiche .brd-ttl'), 'Relevé du 06-12-2025', 'la fiche affiche le relevé créé');
await page.click('#pc-rel-nouveau');
await page.fill('#pc-rel-date', ''); await page.focus('#pc-rel-date'); await page.keyboard.type('12062025', { delay: 40 });
check(/existe déjà/.test(await $t('#pc-rel-note')) && await page.evaluate(() => document.getElementById('pc-rel-qte').value === '250'), 'date déjà saisie : note + litres préremplis');
await page.fill('#pc-rel-qte', '260'); confirms.length = 0; reponse = false; await page.click('#pc-rel-save'); await page.waitForTimeout(100);
check(confirms.length === 1 && /remplacer/i.test(confirms[0]) && confirms[0].includes('250') && confirms[0].includes('260'), 'confirmation d\'écrasement : ' + confirms[0]);
eq(await page.evaluate(() => DB.laitTank.find(l => l.date === '2025-12-06').quantite), 250, 'refus : relevé inchangé');
reponse = true; await page.click('#pc-rel-save'); await page.waitForTimeout(100);
eq(await page.evaluate(() => DB.laitTank.find(l => l.date === '2025-12-06').quantite), 260, 'accord : relevé remplacé');
console.log('OK 4 nouveau relevé : date au clavier, doublon signalé, confirmation d\'écrasement (refus / accord).');

// ================================================================ 5. suppression avec confirmation ; prélèvement conservé
await page.click('.pc-rel[data-date="2025-12-04"]');
confirms.length = 0; reponse = false; await page.click('#pc-rel-del');
check(confirms.length === 1 && /04-12-2025/.test(confirms[0]) && /prélèvement qualité.*conservé/.test(confirms[0]), 'message de confirmation : ' + confirms[0]);
check(await page.evaluate(() => DB.laitTank.some(l => l.date === '2025-12-04')), 'refus : relevé conservé');
reponse = true; await page.click('#pc-rel-del'); await page.waitForTimeout(100);
check(await page.evaluate(() => !DB.laitTank.some(l => l.date === '2025-12-04') && DB.prelevementsQualite.some(p => p.date === '2025-12-04')), 'accord : relevé supprimé, prélèvement qualité conservé');
console.log('OK 5 suppression : confirmation (message sur le prélèvement conservé), refus sans effet, accord.');

// ================================================================ 6. exports : mêmes fonctions que le mobile, campagne affichée
await ouvrir('tank', 2025);
await page.evaluate(() => { window.__saisies = []; });
for (const id of ['btn-export-tank-pdf', 'btn-export-tank-xlsx', 'btn-export-calendrier-pdf']) { await page.click('#' + id); await page.waitForFunction(n => window.__saisies.length >= n, ['btn-export-tank-pdf', 'btn-export-tank-xlsx', 'btn-export-calendrier-pdf'].indexOf(id) + 1, { timeout: 15000 }); }
const ex = await page.evaluate(() => window.__saisies);
check(ex.length === 3 && ex.every(e => /2026/.test(e.nom) && e.n > 500), 'trois exports, campagne 2026 dans le nom : ' + JSON.stringify(ex));
const ref = await page.evaluate(async () => { window.__saisies = []; await exportTankPdf(2025); await exportTankXlsx(2025); await exportCalendrierTankPdf(2025); return window.__saisies; });
eq(ex.map(e => [e.nom, e.mime, e.n]), ref.map(e => [e.nom, e.mime, e.n]), 'PC = fonctions partagées appelées directement (même nom, même type, même taille)');
console.log('OK 6 exports Tank PDF / Excel / Calendrier : mêmes fonctions, même nom de fichier, campagne affichée.');

// ================================================================ 7. Qualité PC : bandeau positif, tuiles, Moyennes par mois, prélèvements du mois, Modifier
await jeu();
await ouvrir('qualite', 2025);
eq(await $t('#pc-production .brd-title'), 'Qualité du lait', 'titre');
eq(await page.evaluate(() => [...document.querySelectorAll('#pc-production .brd-actions button')].map(b => b.textContent)), ['Rapport de campagne (PDF)', '+ Nouveau prélèvement'], 'boutons en haut à droite');
check(!/€/.test(await $t('#app')), 'Qualité PC : aucun montant en euros');
const q = await page.evaluate(() => { const d = qualiteCampagneData(2025); return { tb: d.total.tb, tp: d.total.tp, msu: d.total.msu, cel: d.total.cellules, sa: d.total.moisSuperA, n: d.total.moisAvecPrelevements, nbp: d.total.nbPrelevements, vol: d.total.volume }; });
K = await kpis(); ks = Object.keys(K);
eq(ks.map(k => k.toUpperCase()), ['TB MOYEN', 'TP MOYEN', 'MSU MOYEN', 'CELLULES MOYENNES', 'SUPER A'], 'cinq tuiles');
const fr = (v, d) => v.toFixed(d).replace('.', ',');
eq([K[ks[0]][0], K[ks[1]][0], K[ks[2]][0]], [fr(q.tb, 2), fr(q.tp, 2), fr(q.msu, 2)], 'TB / TP / MSU = fonction de données commune');
eq(K[ks[3]][0], String(Math.round(q.cel / 1000)), 'cellules en milliers/mL (valeur ÷ 1000)');
eq(K[ks[4]][0], q.sa + ' sur ' + q.n, 'Super A « x sur y » mois');
check(/Résultat positif : Salmonelles \(31-07-2026\)/.test(await $t('#qualite-banner')) && /Juillet 2026/.test(await $t('#qualite-banner')), 'bandeau positif sobre en haut : ' + await $t('#qualite-banner'));
eq(await cells('#pc-qualite-mois'), await page.evaluate(() => {
  const d = qualiteCampagneData(2025), f = (v, n) => v === null ? '—' : v.toFixed(n).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const l = d.mois.filter(m => m.nbPrelevements > 0).map(m => [m.libelle, m.volume === null ? '—' : String(Math.round(m.volume * 10) / 10).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' '), String(m.nbPrelevements), f(m.tb, 2), f(m.tp, 2), f(m.msu, 2), String(Math.round(m.cellules / 1000)), m.superA ? 'Obtenu' : 'Non obtenu']);
  const T = d.total;
  return [...l, [d.titre, String(Math.round(T.volume)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), String(T.nbPrelevements), f(T.tb, 2), f(T.tp, 2), f(T.msu, 2), String(Math.round(T.cellules / 1000)), T.moisSuperA + ' sur ' + T.moisAvecPrelevements]];
}), 'tableau Moyennes par mois (mois, volume, prélèvements, TB, TP, MSU, cellules, Super A + total de la campagne)');
eq(await $t('#pc-qualite-prelevs .brd-ttl'), 'Juillet 2026', 'dernier mois à prélèvements affiché à droite');
check(await nb('.pc-prelev') === 1, 'un prélèvement en juillet 2026');
let pt = await $t('.pc-prelev');
check(/31-07-2026/.test(pt) && /120 L/.test(pt) && /TB 90,00|TB90,00/.test(pt) && /MSU160,00|MSU 160,00/.test(pt) && /Cellules300/.test(pt.replace(/\s/g, '')) && /Salmonelles/.test(pt) && /positif/i.test(pt) && !/Super A/.test(pt), 'toutes les analyses, Super A annulé (salmonelles positif) : ' + pt);
await page.click('.pc-qmois-row[data-cle="2025-12"]');
pt = await $t('.pc-prelev');
check(/05-12-2025/.test(pt) && /Super A/.test(pt) && /Cellules400/.test(pt.replace(/\s/g, '')) && !/400 000/.test(pt), 'décembre 2025 : Super A obtenu, cellules en milliers (400, pas 400 000) : ' + pt);
await page.click('#qualite-banner'); eq(await $t('#pc-qualite-prelevs .brd-ttl'), 'Juillet 2026', 'clic sur le bandeau : mois du résultat positif');
console.log('OK 7 Qualité PC : bandeau positif, 5 tuiles, tableau Moyennes par mois (= fonctions communes), prélèvements du mois avec toutes les analyses, cellules en milliers/mL.');

// ================================================================ 8. Modifier, + Nouveau prélèvement, rapport de campagne, campagne sans mélange
await page.click('.pc-qmois-row[data-cle="2025-12"]');
await page.click('.pc-prelev-modif[data-date="2025-12-05"]');
check(await nb('.sheet-card') === 1, 'Modifier ouvre la fiche du prélèvement');
await page.evaluate(() => document.querySelector('.sheet-close-btn').click());
check(await nb('.sheet-card') === 0, 'fiche fermée');
await page.click('#btn-qualite-add');
check(await nb('.sheet-card') === 1, '+ Nouveau prélèvement ouvre la fiche vide');
await page.evaluate(() => document.querySelector('.sheet-close-btn').click());
await page.evaluate(() => { window.__saisies = []; });
await page.click('#btn-rapport-qualite'); await page.waitForFunction(() => window.__saisies.length >= 1, null, { timeout: 15000 });
const rap = await page.evaluate(() => window.__saisies[0]); const rapRef = await page.evaluate(async () => { window.__saisies = []; await exportRapportCampagnePdf(2025); return window.__saisies[0]; });
eq([rap.nom, rap.mime, rap.n], [rapRef.nom, rapRef.mime, rapRef.n], 'rapport de campagne : même fonction, même nom, même taille que l\'appel direct');
await page.selectOption('#pl-pc-campagne', '2026');
eq(await $$t('#pc-qualite-mois tbody tr td:first-child'), ['Octobre 2026', 'Campagne 2027'], 'autre campagne : uniquement ses mois');
check(!/Salmonelles/.test(await $t('#app')) && !/Super A \(/.test(await $t('#app')), 'aucun résultat d\'une autre campagne (bandeau positif absent)');
check(/résultats à saisir/.test(await $t('.pc-prelev')), 'prélèvement du 02-10-2026 sans analyses : « résultats à saisir »');
console.log('OK 8 Modifier / + Nouveau prélèvement / rapport de campagne ; changement de campagne sans mélange.');

// ================================================================ 9. nouveau prélèvement saisi au clavier : la page se place sur son mois et sa campagne
await jeu(); await ouvrir('qualite', 2026);
await page.click('#btn-qualite-add');
await page.focus('#qs-date'); await page.keyboard.type('12042025', { delay: 40 });
await page.waitForTimeout(200);
check(await page.evaluate(() => document.getElementById('qs-date').value) === '2025-12-04', 'date tapée dans la fiche de prélèvement : ' + await page.evaluate(() => document.getElementById('qs-date').value));
await page.click('#qs-tb'); await page.keyboard.type('71.5', { delay: 40 });
await page.click('#qs-save'); await page.waitForTimeout(150);
check(await page.evaluate(() => { const p = DB.prelevementsQualite.find(x => x.date === '2025-12-04'); return !!p && p.tb === 71.5 && p.volumeLait === 300; }), 'prélèvement créé avec le volume du relevé du jour');
eq(await page.evaluate(() => [plPcCampagne, plPcMoisQual]), [2025, '2025-12'], 'la page suit : campagne 2026, décembre 2025');
check(/04-12-2025/.test(await $t('#pc-qualite-prelevs')) && /71,50/.test(await $t('#pc-qualite-prelevs')), 'le prélèvement est visible dans son mois');
console.log('OK 9 nouveau prélèvement : date et TB au clavier, volume repris du relevé, la page affiche son mois.');

// ================================================================ 10. données réelles (lecture seule), PC
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await page.evaluate((json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB);
    const camps = campagnesProductionLaitiere();
    const res = [];
    camps.forEach(c => {
      plOnglet = 'tank'; plPcCampagne = c; plPcMoisTank = null; plPcDate = null; render('qualite');
      const d = tankCampagneData(c);
      const tankOk = document.querySelectorAll('#pc-tank-mois tbody tr').length === (d.moisAvecLait.length ? d.moisAvecLait.length + 1 : 0) || !d.moisAvecLait.length;
      plOnglet = 'qualite'; plPcMoisQual = null; render('qualite');
      const q = qualiteCampagneData(c), nQ = q.mois.filter(m => m.nbPrelevements > 0).length;
      const qualOk = document.querySelectorAll('#pc-qualite-mois tbody tr').length === (nQ ? nQ + 1 : 0);
      res.push({ c, tankOk, qualOk, litres: d.total.litres });
    });
    return { res, intact: JSON.stringify(DB) === avant && window.__saves === 0 };
  }, j);
  check(out.intact && out.res.every(r => r.tankOk && r.qualOk), 'données réelles : une ligne par mois + total, aucune écriture : ' + JSON.stringify(out));
  console.log('OK 10 données réelles (lecture seule) : ' + out.res.map(r => 'campagne ' + (r.c + 1) + ' = ' + r.litres + ' L').join(' ; '));
}
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « PRODUCTION LAITIÈRE » SONT PASSÉS');
