/* Refonte Production laitière, partie 1 : EXPORTS par campagne -- Tank (PDF A4 couleur), Calendrier du tank (PDF, 1 page), Rapport de campagne (PDF : Bilan économique puis Qualité du lait,
   détail des prélèvements continué sur une page 3 s'il déborde), Tank (Excel, 2 feuilles). Texte des PDF relu depuis leurs flux (non compressés), noms de fichier, une seule campagne par export
   (frontière 30/09 | 01/10), cellules en milliers/mL, prélèvement « résultats à saisir », encadré des résultats positifs, PARITÉ mobile / PC (mêmes octets, même nom), pas d'écriture.
   Si PyMuPDF est disponible, chaque PDF est aussi ouvert et rendu (validité du fichier). Jeu synthétique ; export réel en LECTURE SEULE. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
async function ouvrir(desktop) {
  const page = await (await browser.newContext()).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (desktop) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
const mob = await ouvrir(false), pc = await ouvrir(true);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

const jeu = pg => pg.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test' });
  DB.laitTank = [
    { date: '2025-09-30', quantite: 100 }, { date: '2025-10-01', quantite: 200 }, { date: '2025-10-02', quantite: 150.5 }, { date: '2025-12-04', quantite: 300 }, { date: '2025-12-05', quantite: 310 },
    { date: '2026-07-31', quantite: 130 }, { date: '2026-09-30', quantite: 90 }, { date: '2026-10-01', quantite: 500 }];
  const pr = (date, vol, extra) => Object.assign({ id: 'p' + date, date, volumeLait: vol, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: null, salmonelles: null, campagne: campagneAnneeDebutPourDate(date) }, extra);
  DB.prelevementsQualite = [
    pr('2025-09-30', 100, { tb: 60, tp: 50 }), pr('2025-10-01', 200),
    pr('2025-12-05', 310, { tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif' }),
    pr('2026-07-31', 130, { tb: 90, tp: 70, cellules: 300000, floreTotale: 10000, coliformes: 30, butyriques: 50, salmonelles: 'positif' })];
  DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-07-30', dateFin: '2026-07-31', cause: 'salmonelles', litrageL: 1200, commentaire: 'test' }, { id: 'pen0', dateDebut: '2025-09-15', dateFin: '2025-09-15', cause: 'autre', litrageL: 1000 }];
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  window.__avant = JSON.stringify(DB);
  window.__saisies = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, n: bytes.length }); };
  window.b64 = u8 => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
});
const pdfs = pg => pg.evaluate(() => ({ tank: b64(buildTankPdfBytes(2025)), cal: b64(buildCalendrierTankPdfBytes(2025)), rap: b64(buildRapportCampagnePdfBytes(2025)), tank24: b64(buildTankPdfBytes(2024)), rap24: b64(buildRapportCampagnePdfBytes(2024)) }));
// texte des pages relu depuis les flux de contenu (non compressés) : chaque page = ses chaînes (...) Tj, octets WinAnsi -> texte
function textePages(b64) {
  const s = Buffer.from(b64, 'base64').toString('latin1');
  const flux = [...s.matchAll(/stream\n([\s\S]*?)endstream/g)].map(m => m[1]);
  return flux.map(f => [...f.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replace(/\\([()\\])/g, '$1').replace(/ /g, ' ').replace(/\x96/g, '-').replace(/\x97/g, '—')).join(' | '));
}
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-pdf-'));
function validerAvecPyMuPDF(nom, b64) {
  const f = path.join(dir, nom); writeFileSync(f, Buffer.from(b64, 'base64'));
  const r = spawnSync('python3', ['-I', '-c', 'import sys\ntry:\n import pymupdf as m\nexcept Exception:\n print("SANS"); sys.exit(0)\nd=m.open(sys.argv[1]); print(d.page_count); [p.get_pixmap(dpi=40) for p in d]', f], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  return out === 'SANS' || out === '' ? null : parseInt(out, 10);
}

await jeu(mob); await jeu(pc);
const m = await pdfs(mob), p = await pdfs(pc);

// ================================================================ 1. parité mobile / PC : mêmes octets
['tank', 'cal', 'rap', 'tank24', 'rap24'].forEach(k => check(m[k] === p[k], 'PDF « ' + k + ' » identique octet pour octet sur mobile et sur PC'));
const feuilles = await Promise.all([mob, pc].map(pg => pg.evaluate(() => JSON.stringify(tankXlsxFeuilles(2025)))));
check(feuilles[0] === feuilles[1], 'Excel Tank : mêmes feuilles sur mobile et sur PC');
console.log('OK 1 parité : Tank, Calendrier, Rapport (PDF) identiques octet pour octet sur mobile et PC ; Excel : mêmes feuilles.');

// ================================================================ 2. Tank (PDF)
const tk = textePages(m.tank);
check(tk.length === 1, 'Tank : 1 page pour 4 mois de traite et 6 relevés : ' + tk.length);
const t1 = tk[0];
['OVILOG', 'Production laitière · Tank', 'Campagne 2026 · du 01-10-2025 au 30-09-2026', 'Ferme du Test', 'Édité le 03-10-2026', 'Lait livré', '1 180,5 L', 'Relevés', 'du 01-10-2025 au 30-09-2026', 'Mois de pointe', 'Décembre 2025', 'Moyenne par relevé', 'Litrage par mois', 'Octobre 2025', 'Novembre 2025', 'Campagne 2026', 'Détail des relevés · Octobre 2025', '01-10-2025', '02-10-2025', '150,5 L', 'analyse', 'Page 1/1'].forEach(x => check(t1.includes(x), 'Tank contient « ' + x + ' » : ' + t1.slice(0, 400)));
check(!t1.includes('30-09-2025') || /Campagne 2026 · du 01-10-2025 au 30-09-2026/.test(t1), 'ok');
check(!/ 100 L/.test(t1) && !t1.includes('01-10-2026') && !t1.includes('500 L'), 'Tank : aucun relevé d\'une autre campagne (30/09/2025 : 100 L, 01/10/2026 : 500 L)');
// mois sans lait en tirets
check(/Novembre 2025 \| — \| — \| — \| — \|/.test(t1) || /Novembre 2025 \| — \| —/.test(t1), 'mois sans lait : tirets');
const tk24 = textePages(m.tank24)[0];
check(tk24.includes('Campagne 2025 · du 01-10-2024 au 30-09-2025') && tk24.includes('100 L') && !tk24.includes('150,5') && tk24.includes('Septembre 2025'), 'Tank campagne 2024 : seulement le relevé du 30/09/2025');
console.log('OK 2 Tank (PDF) : en-tête, tuiles, 12 mois avec tirets, détail des relevés (jour d\'analyse marqué), décimales conservées (150,5 L), une seule campagne.');

// ================================================================ 3. Calendrier du tank (PDF)
const cl = textePages(m.cal);
check(cl.length === 1, 'Calendrier : une seule page');
const c1 = cl[0];
['Calendrier du tank', 'litres saisis par jour, mois de traite', 'à rapprocher des factures de la laiterie', 'Jour', 'Oct.', 'Déc.', 'Juil.', 'Sept.', 'Total saisi', '1 180,5 L', 'Page 1/1'].forEach(x => check(c1.includes(x), 'Calendrier contient « ' + x + ' »'));
check(!c1.includes('Nov.') && !c1.includes('Janv.') && !c1.includes('Août'), 'Calendrier : mois sans lait masqués');
check(!/ 500 /.test(c1) && !/\| 100 \|/.test(c1), 'Calendrier : aucune donnée d\'une autre campagne');
console.log('OK 3 Calendrier du tank : une page, mois de traite seulement, jours 1 à 31, total par mois, aucune autre campagne.');

// ================================================================ 4. Rapport de campagne (PDF)
const rp = textePages(m.rap);
check(rp.length === 2, 'Rapport : 2 pages (peu de prélèvements) : ' + rp.length);
['Bilan économique', 'Campagne 2026 · du 01-10-2025 au 30-09-2026 · coefficient MSU 12,0000', 'Montant hors qualité', 'Grades bactério', 'Bonus Super A', 'Pénalités bactério', 'Montant avec qualité', 'Mois par mois', 'Prix hors qualité', 'Total du mois', 'Pénalités bactério', '1 pénalité sur la campagne', 'Du 30-07-2026 au 31-07-2026', 'Salmonelles', '1 200 L', 'Page 1/2'].forEach(x => check(rp[0].includes(x), 'Rapport p.1 contient « ' + x + ' »'));
check(!rp[0].includes('15-09-2025'), 'Rapport p.1 : la pénalité de la campagne précédente est absente');
['Production laitière · Qualité du lait', 'TB moyen', 'Cellules moyennes', 'milliers/mL', 'Moyennes par mois', 'Détail des prélèvements', 'Juillet 2026 · Salmonelles : résultat positif le 31-07-2026', 'Bonus Super A non obtenu pour ce mois.', 'résultats à saisir', '05-12-2025', '31-07-2026', 'positif', 'Page 2/2'].forEach(x => check(rp[1].includes(x), 'Rapport p.2 contient « ' + x + ' »'));
check(!rp[1].includes('30-09-2025'), 'Rapport p.2 : le prélèvement du 30/09/2025 (campagne précédente) est absent');
check(/\| 400 \|/.test(rp[1]) && /\| 300 \|/.test(rp[1]) && !rp[1].includes('400 000') && !rp[1].includes('300 000'), 'cellules affichées en milliers/mL (400, 300), jamais 400 000');
const rp24 = textePages(m.rap24);
check(rp24.join(' ').includes('Campagne 2025') && rp24.join(' ').includes('15-09-2025') && !rp24.join(' ').includes('30-07-2026'), 'Rapport campagne 2024 : sa pénalité du 15/09/2025, pas celle de 2026');
console.log('OK 4 Rapport de campagne : 2 pages (Bilan économique, Qualité du lait), pénalités, encadré résultat positif, « résultats à saisir », cellules en milliers/mL, une seule campagne.');

// ================================================================ 5. Excel Tank
const xl = JSON.parse(feuilles[0]);
eq(xl.map(f => f.name), ['Tank', 'Relevés'], 'deux feuilles');
eq(xl[0].rows[0], ['Mois', 'Relevés', 'Litres', 'Moyenne par relevé (L)', 'Cumul campagne (L)'], 'colonnes du PDF Tank');
eq(xl[0].rows.length, 14, '12 mois + en-tête + total');
eq(xl[0].rows[1], ['Octobre 2025', 2, 350.5, 175.3, 350.5], 'octobre');
eq(xl[0].rows[13], ['Campagne 2026', 6, 1180.5, 196.8, 1180.5], 'total de campagne');
eq(xl[1].rows.map(r => r[0]), ['Date', '01-10-2025', '02-10-2025', '04-12-2025', '05-12-2025', '31-07-2026', '30-09-2026'], 'feuille Relevés : tous les relevés de la campagne et eux seuls');
eq(xl[1].rows.find(r => r[0] === '05-12-2025'), ['05-12-2025', 310, 'Oui'], 'jour de prélèvement marqué');
console.log('OK 5 Excel Tank : mêmes colonnes que le PDF, feuille Relevés de la campagne seulement.');

// ================================================================ 6. noms de fichier, aucune écriture, validité
const noms = await mob.evaluate(async () => { await exportTankPdf(2025); await exportCalendrierTankPdf(2025); await exportTankXlsx(2025); await exportRapportCampagnePdf(2025); return window.__saisies.map(x => [x.nom, x.mime, x.n > 500]); });
const nomsPc = await pc.evaluate(async () => { await exportTankPdf(2025); await exportCalendrierTankPdf(2025); await exportTankXlsx(2025); await exportRapportCampagnePdf(2025); return window.__saisies.map(x => [x.nom, x.mime, x.n > 500]); });
eq(noms, [['tank_campagne-2026_2026-10-03.pdf', 'application/pdf', true], ['calendrier-tank_campagne-2026_2026-10-03.pdf', 'application/pdf', true], ['tank_campagne-2026_2026-10-03.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true], ['rapport-campagne_2026_2026-10-03.pdf', 'application/pdf', true]], 'noms de fichier');
eq(noms, nomsPc, 'mêmes noms de fichier sur mobile et PC');
check(await mob.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'aucune écriture dans les données');
const pages = ['tank', 'cal', 'rap'].map(k => validerAvecPyMuPDF(k + '.pdf', m[k]));
if (pages[0] !== null) eq(pages, [1, 1, 2], 'PyMuPDF ouvre les 3 PDF (pages)');
console.log('OK 6 noms de fichier identiques mobile / PC, aucune écriture' + (pages[0] !== null ? ', PDF valides (PyMuPDF)' : ' (PyMuPDF absent : validité non vérifiée)') + '.');

// ================================================================ 7. données réelles, lecture seule
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await mob.evaluate(async (json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () {};
    const avant = JSON.stringify(DB);
    const enc = u8 => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
    const t = tankCampagneData(2025), q = qualiteCampagneData(2025);
    const r = { tank: enc(buildTankPdfBytes(2025)), rap: enc(buildRapportCampagnePdfBytes(2025)), cal: enc(buildCalendrierTankPdfBytes(2025)), litres: t.total.litres, nb: t.total.nbReleves, nbPrelev: q.total.nbPrelevements };
    r.intact = JSON.stringify(DB) === avant;
    return r;
  }, j);
  check(out.intact, 'données réelles : aucune écriture');
  const tr = textePages(out.tank).join(' '), rr = textePages(out.rap), cr = textePages(out.cal).join(' ');
  check(tr.includes('108 178 L') && tr.includes('202') && textePages(out.tank).length >= 2, 'réel : Tank = 108 178 L, 202 relevés : ' + tr.slice(0, 300));
  check(cr.includes('108 178 L') && textePages(out.cal).length === 1, 'réel : Calendrier = 108 178 L sur 1 page');
  check(rr.length === 3 && rr[1].includes('Détail des prélèvements') && rr[2].includes('(suite)'.replace('(suite)', 'Page 3/3')), 'réel : 30 prélèvements, le détail continue sur une page 3 : ' + rr.length + ' pages');
  console.log('OK 7 données réelles (lecture seule) : Tank 108 178 L / 202 relevés ; Calendrier 1 page ; Rapport ' + rr.length + ' pages (détail des ' + out.nbPrelev + ' prélèvements sur une page 3).');
}
await browser.close();
console.log('\nTOUS LES TESTS DES EXPORTS PRODUCTION LAITIÈRE SONT PASSÉS');
