/* Tri des agnelles, deux impressions bien séparées (PC et mobile, même liste et même ordre que l'écran, mêmes colonnes en Excel et en PDF) :
   À trier = « Feuille de tri » (de quoi décider + cases Garder / Écarter vides + Notes) ; Gardées = « Liste SIEOL » (exactement 9 colonnes) ; Écartées = inchangé.
   agnelle : « N° boucle » = 5 derniers chiffres ; mère : n° court SIEOL s'il est connu, sinon « — » ; numéros repris tels qu'enregistrés ; agnelle achetée : n° saisis
   à l'achat ; père : code IA et n° officiel de l'IA importée. Exports aussi sur mobile, PDF identique au PC. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const jeu = () => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'EARL Exemple' });
  const fiche = (n, id, o) => Object.assign({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, o || {});
  const ia = { pereCourt: '12345', pereNumero: '00006445678', indexIsol: 112, source: 'import' };
  DB.brebis = [fiche('669002', 'b1', { numeroCourtTravailSieol: '902' }), fiche('668117', 'b2')]; DB.beliers = []; DB.lots = [];
  DB.brebis[0].agnelages = [{ date: '2026-10-05', campagne: 2026, codeRepro: 'IA', lambs: [
    { sexe: 'Femelle', adopte: false, eid: '250000045671024', numeroCourtTravailSieol: '1024', pere: 'FR 000064 45678', pereIa: ia, sanitaire: [], mouvements: [] },
    { sexe: 'Mâle', adopte: false, eid: '250000045671025', sanitaire: [], mouvements: [] }] }];
  DB.brebis[1].agnelages = [{ date: '2026-10-06', campagne: 2026, codeRepro: 'MN', lambs: [
    { sexe: 'Femelle', adopte: false, eid: '250000045671031', sanitaire: [], mouvements: [] },
    { sexe: 'Femelle', adopte: false, eid: '250000045671032', triStatut: 'gardée', sanitaire: [], mouvements: [] }] }];
  DB.agnelles = [
    { id: 'g1', eid: '250000045671032', origine: 'née', motherEid: DB.brebis[1].eid, dateEntree: '2026-10-20', sanitaire: [], notes: [], mouvements: [{ type: 'Naissance', cause: null, date: '2026-10-06' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-10-20' }] },
    { id: 'g2', eid: '250000012370045', origine: 'achetée', dateEntree: '2026-10-01', mere: 'FR 000123 60012', pere: '', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-10-01' }] }];
};
const tables = {};
for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext(bureau ? { viewport: { width: 1400, height: 1000 } } : { viewport: { width: 390, height: 844 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(jeu);
  await p.evaluate(() => { window.__xl = []; window.__f = []; buildXlsxWorkbook = async (f) => { window.__xl.push(JSON.parse(JSON.stringify(f))); return new Uint8Array([1]); }; saveOrShareBinaryFile = async (n, b) => { window.__f.push({ n, b: Array.from(b) }); }; });
  for (const onglet of ['aTrier', 'gardees', 'ecartees']) {
    await p.evaluate((o) => { if (isDesktopMode()) { triPcEtat = null; render('agnelles'); triPcEtat.onglet = o; } else triMobileOnglet = o; render('agnelles'); window.__xl = []; window.__f = []; }, onglet);
    const ids = bureau ? ['#ta-export', '#ta-export-pdf'] : ['#tm-export-xlsx', '#tm-export-pdf'];
    const actif = await p.evaluate((i) => !document.querySelector(i[0]).disabled && !document.querySelector(i[1]).disabled, ids);
    if (onglet === 'ecartees') { check(!actif, nom + ' : aucune écartée, exports inactifs'); continue; }
    check(actif, nom + ' : exports présents et actifs (' + onglet + ')');
    await p.click(ids[0]); await p.click(ids[1]); await p.waitForTimeout(200);
    tables[nom + onglet] = await p.evaluate(() => ({ feuille: window.__xl[0][0].name, rows: window.__xl[0][0].rows, noms: window.__f.map(f => f.n), pdf: window.__f.find(f => /\.pdf$/.test(f.n)).b.length }));
  }
  await p.context().close();
}
const T = tables.PCaTrier, G = tables.PCgardees;
eq([T.feuille, T.noms], ['Feuille de tri', ['feuille-de-tri-agnelles_2026-11-20.xlsx', 'feuille-de-tri-agnelles_2026-11-20.pdf']], 'À trier : feuille « Feuille de tri », fichiers');
eq(T.rows, [['N° boucle', 'Naissance', 'Mode repro', 'Portée', 'Mère n° court', 'Mère classe', 'Mère lact. N-1 (L)', 'Père code IA', 'ISOL père', 'Garder', 'Écarter', 'Notes'],
  ['71024', '05-10-2026', 'IA', '2', '902', '—', '—', '12345', '112', '', '', ''],
  ['71031', '06-10-2026', 'MN', '2', '—', '—', '—', '—', '—', '', '', '']],
  'Feuille de tri : agnelle = n° de boucle (5 derniers chiffres, même si un n° de travail existe), mère = n° court SIEOL sinon « — », portée en nombre, père de l\'IA, cases et notes vides');
eq([G.feuille, G.noms], ['Liste SIEOL', ['agnelles-gardees-sieol_2026-11-20.xlsx', 'agnelles-gardees-sieol_2026-11-20.pdf']], 'Gardées : feuille « Liste SIEOL », fichiers');
eq(G.rows, [['N° boucle', 'N° officiel', 'Naissance', 'Mode repro', 'Portée', 'Mère n° court', 'Mère n° officiel', 'Père code IA', 'Père n° officiel'],
  ['70045', 'FR 000123 70045', '—', '—', '—', '—', 'FR 000123 60012', '—', '—'],
  ['71032', 'FR 000456 71032', '06-10-2026', 'MN', '2', '—', 'FR 000456 68117', '—', '—']],
  'Liste SIEOL : 9 colonnes, même ordre que l\'écran (achetée entrée le 01-10, puis née le 06-10) ; achetée : n° de la mère saisi à l\'achat, le reste « — »');
for (const o of ['aTrier', 'gardees']) {
  eq(tables['mobile' + o].rows, tables['PC' + o].rows, 'mobile = PC, mêmes lignes (' + o + ')');
  eq(tables['mobile' + o].pdf, tables['PC' + o].pdf, 'mobile = PC, même PDF (' + o + ')');
}
await browser.close();
console.log('\nTOUS LES TESTS « EXPORTS DU TRI DES AGNELLES » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
