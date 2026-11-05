/* Registre d'élevage › Agnelage : un agneau sans n° n'est JAMAIS un mort-né. Case « N° agneau » (une seule règle, libelleNumeroAgneauRegistre) identique sur l'écran PC,
   les cartes mobiles, l'Excel et le PDF : bouclé → n° ; né mort → « Mort-né » ; vivant pas encore bouclé → « À boucler » ; mort sans avoir été bouclé → « Mort avant bouclage · date ».
   Une fois bouclé, son n°. Fiche brebis : « sans n° », jamais « n°? ». Affichage seul : la donnée n'est jamais modifiée. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ATTENDU = ['n°00045671024', 'Mort-né', 'À boucler', 'Mort avant bouclage · 10-11-2026'];
for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext(bureau ? { viewport: { width: 1400, height: 1000 } } : { viewport: { width: 390, height: 844 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
    const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [fiche('669002', 'b1')]; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.brebis[0].agnelages = [{ date: '2026-11-05', campagne: 2026, codeRepro: 'MN', lambs: [
      { sexe: 'Mâle', adopte: false, eid: '250000045671024', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-05' }] },
      { sexe: 'Mort-né', adopte: false },
      { sexe: 'Femelle', adopte: false },
      { sexe: 'Mâle', adopte: false, statutFinal: 'mort', mouvements: [{ type: 'Mort', cause: 'Faiblesse', acheteur: null, date: '2026-11-10' }] }] }];
    window.__avant = JSON.stringify(DB);
    window.__xlsx = null; window.__pdf = null;
    buildXlsxWorkbook = async (s) => { window.__xlsx = JSON.parse(JSON.stringify(s)); return new Uint8Array([1]); };
    const pdfOrig = buildPdfTableCharte; buildPdfTableCharte = (o) => { window.__pdf = JSON.parse(JSON.stringify(o.rows || [])); return pdfOrig(o); };
    saveOrShareBinaryFile = async () => {};
    registreView = 'agnelage'; registreFiltre = ''; registreColFiltres.agnelage = { sexe: '', campagne: '' };
  });
  // ordre des agneaux dans la mise bas = ordre des lignes (même date)
  const libelles = await p.evaluate(() => registreAgnelageRows().map(r => libelleNumeroAgneauRegistre(r, true)));
  eq(libelles.slice().sort(), ATTENDU.slice().sort(), nom + ' : les 4 cas (court, exports)');
  // écran
  const ecran = await p.evaluate((pc) => {
    if (pc) { const d = document.createElement('div'); d.innerHTML = registrePcTableHtml('agnelage').html; return [...d.querySelectorAll('tr')].slice(1).map(tr => tr.children[1].textContent); }
    const V = registreMobileVue('agnelage', '', registreColFiltres.agnelage); const d = document.createElement('div'); d.innerHTML = V.rows.map(V.carte).join(''); return d.textContent;
  }, bureau);
  if (bureau) eq(ecran.slice().sort(), ['Mort avant bouclage · 10-11-2026', 'Mort-né', 'À boucler', 'n°71024'].sort(), 'PC : colonne N° agneau du tableau');
  else check(['Agneau n°71024', 'Mort-né', 'À boucler', 'Mort avant bouclage · 10-11-2026'].every(t => ecran.includes(t)) && (ecran.match(/Mort-né/g) || []).length === 2, 'mobile : cartes du registre (« Mort-né » seulement sur la carte du mort-né : pastille + ligne) : ' + ecran);
  // Excel
  await p.evaluate(() => exportRegistreXlsx());
  const xl = await p.evaluate(() => window.__xlsx.find(f => f.name === 'Agnelage').rows.slice(1).map(r => r[1]));
  eq(xl.slice().sort(), ATTENDU.slice().sort(), nom + ' : Excel, colonne N° agneau');
  // PDF
  await p.evaluate(() => exportRegistrePdf());
  const pdf = await p.evaluate(() => window.__pdf.map(r => String(r[1])));
  check(ATTENDU.every(t => pdf.some(x => x.startsWith(t.slice(0, 12)))) && pdf.filter(x => x === 'Mort-né').length === 1, nom + ' : PDF, colonne N° agneau : ' + JSON.stringify(pdf));
  // fiche brebis : « sans n° », jamais « n°? »
  await p.evaluate(() => { currentSheepId = 'b1'; detailOrigin = 'list'; ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = 'b1'; render('detail', 'b1'); });
  check(await p.evaluate(() => { const t = document.getElementById('app').textContent; return !/n°\?/.test(t) && /sans n°/.test(t); }), nom + ' : fiche brebis : « sans n° », jamais « n°? »');
  // une fois bouclé : son n°
  await p.evaluate(() => { DB.brebis[0].agnelages[0].lambs[2].eid = '250000045671025'; });
  check(await p.evaluate(() => registreAgnelageRows().map(r => libelleNumeroAgneauRegistre(r)).includes('n°71025')), nom + ' : bouclé ensuite : son n°');
  await p.evaluate(() => { DB.brebis[0].agnelages[0].lambs[2].eid = undefined; delete DB.brebis[0].agnelages[0].lambs[2].eid; });
  check(await p.evaluate(() => JSON.stringify(DB) === window.__avant), nom + ' : affichage seul, aucune donnée modifiée');
  console.log('OK ' + nom);
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « REGISTRE : AGNEAUX SANS N° » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
