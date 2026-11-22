/* Contrôle laitier (mobile et PC, écran, Export PDF, Export Excel) : n° de chaque brebis = numeroAnimal (n° de travail, sinon « n° » + n° d'ordre),
   jamais de case vide ; tri par défaut = âge puis n° de travail croissant (601, 602, 6100), puis, sans n° de travail, n° d'ordre
   (comparerAnimauxAgeNumero, comme toutes les listes). Mises bas PC : même n°. saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ATTENDU = ['601', '602', '6100', 'n°20104'];

for (const mobile of [true, false]) {
  const nom = mobile ? 'mobile' : 'PC';
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-12-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', typeSuivi: 'cls' });
    const E = n => '2500000456' + n;
    // même millésime (boucle en 0) ; n° de travail 6100, 602, 601, puis une brebis SANS n° de travail ; ordre de saisie mélangé
    DB.brebis = [['6100', '20101'], ['', '20104'], ['602', '20102'], ['601', '20103']].map(([c, o], i) => ({ id: 'b' + i, eid: E(o), numeroCourtTravailSieol: c, statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2020-01-01' }], modesRepro: [],
      agnelages: [{ date: '2026-10-1' + i, campagne: 2027, codeRepro: 'MN', saisieA: 1000 + i, lambs: [{ sexe: 'Mâle', statutFinal: 'vendu' }] }],
      controleLaitier: [{ controle: 1, quantite: 1500 + i, anomalie: null, date: '2026-11-10', campagne: 2027 }] }));
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.resumeControleLaitier = []; DB.cahierControleLaitier = [];
    // les exports : tableau relevé, rien d'enregistré
    window.__pdf = null; window.__xlsx = null;
    const pdf0 = buildPdfTableCharte, xl0 = buildXlsxWorkbook;
    buildPdfTableCharte = o => { window.__pdf = o.rows.map(r => r[0]); return pdf0(o); };
    buildXlsxWorkbook = sh => { window.__xlsx = sh[0].rows.slice(1).map(r => r[0]); return xl0(sh); };
    saveOrShareBinaryFile = async () => {};
    render('controle-laitier');
  });
  await p.waitForTimeout(300);
  const ecran = await p.evaluate(m => [...document.querySelectorAll(m ? '.cl-carte .cl-num' : 'td.num-fixe')].map(e => e.textContent.trim()), mobile);
  eq(ecran, ATTENDU, nom + ' : écran = n° de travail, sinon « n° » + n° d\'ordre ; ordre âge puis n° de travail (601, 602, 6100), sans n° de travail à la fin');
  await p.evaluate(async () => { const r = [...document.querySelectorAll('button')].find(b => /Export PDF/.test(b.textContent)); r.click(); });
  await p.waitForFunction(() => window.__pdf);
  await p.evaluate(async () => { const r = [...document.querySelectorAll('button')].find(b => /Export Excel/.test(b.textContent)); r.click(); });
  await p.waitForFunction(() => window.__xlsx);
  eq(await p.evaluate(() => [window.__pdf, window.__xlsx]), [ATTENDU, ATTENDU], nom + ' : Export PDF et Export Excel = mêmes n°, même ordre, aucune case vide');
  if (!mobile) {
    await p.evaluate(() => render('misebas-rapide')); await p.waitForTimeout(200);
    const mb = await p.evaluate(() => [...document.querySelectorAll('#mb-table-campagne tr td:first-child')].map(e => e.textContent.trim()));
    check(mb.includes('n°20104') && mb.includes('6100') && !mb.includes(''), nom + ' : Mises bas PC = même n° (numeroAnimal) : ' + JSON.stringify(mb));
  }
  // moyenne d'un contrôle = toutes les brebis contrôlées ce jour-là : une vendue depuis (fiche gardée) et une du registre restent comptées
  if (mobile) {
    eq(await p.evaluate(() => { const d = controleLaitierPcData([], [1]); return [d.moyennes[1].n, d.moyennes[1].moyenne]; }), [4, 1501.5], 'moyenne C1 : 4 brebis présentes');
    eq(await p.evaluate(() => {
      DB.brebis[0].statut = 'vendue';
      DB.registre.brebis['250000045629999'] = { controleLaitier: [{ controle: 1, quantite: 1000, campagne: 2027 }, { controle: 1, quantite: 700, campagne: 2026 }] };
      DB.brebis.push({ id: 'x', eid: '250000045629998', statut: 'active', controleLaitier: [{ controle: 1, quantite: null, anomalie: 9, campagne: 2027 }] });
      const d = controleLaitierPcData([], [1]); return [d.moyennes[1].n, d.moyennes[1].moyenne];
    }), [5, 1401.2], 'moyenne C1 : la vendue et la brebis du registre restent ; un code sans lait et une autre campagne ne comptent pas');
  }
  console.log('OK ' + nom + ' : n° et ordre du Contrôle laitier (écran, PDF, Excel)' + (mobile ? ', moyennes' : ', Mises bas PC') + '.');
  await ctx.close();
}
await browser.close();
console.log('test_controle_laitier_numeros : OK');
