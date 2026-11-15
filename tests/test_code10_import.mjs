/* Code 10 = vide définitive, à l'import du contrôle laitier (PC : SIEOL et modèle Excel Ovilog) :
   - libellé « Vide définitive » ; l'import SIEOL garde un contrôle qui ne porte qu'un code (quantité vide), comme le modèle Excel ;
   - modèle Excel : « 1400/10 » et « /10 » lus (codes 01 à 11) ; « 10 » seul reste 10 mL ;
   - carte « Code 10 · vide définitive » (classerCode10Import) : code 10 sans lait = à marquer (case décochée d'office, sans source affichée),
     code 10 AVEC du lait = à vérifier (source et lait montrés, case à part), déjà marquée = rien n'est changé, marquée sans code 10 = information ;
     rien n'est marqué sans case cochée ; les cases cochées marquent la campagne de l'import ;
   - fiche brebis : n° de lactation dans l'onglet Index (« 3e lactation »), plus dans Contrôles ; un contrôle sans lait affiche « sans lait ».
   Jeu SYNTHÉTIQUE (indicatif 000456), aucune donnée réelle. OVILOG_CAPTURES=<dossier> : captures pour le propriétaire. */
import { chromium } from 'playwright';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const CAP = process.env.OVILOG_CAPTURES || '';
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple', typeSuivi: 'cls', nbControlesSuivi: 3 });
  const E = n => '2500000456' + n;
  DB.brebis = ['601', '602', '603', '604', '605', '606'].map((c, i) => ({ id: 'b' + c, eid: E(String(20101 + i)), numeroCourtTravailSieol: c, statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [], modesRepro: [], controleLaitier: [], agnelages: [],
    videesDefinitives: c === '603' || c === '606' ? [{ campagne: 2026, date: '2026-12-01' }] : [] }));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
};
async function ouvrir(bureau) {
  const ctx = await browser.newContext({ viewport: bureau ? { width: 1400, height: 1400 } : { width: 390, height: 844 }, deviceScaleFactor: CAP ? 2 : 1 });
  if (bureau) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2027-03-25T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.__alertes = []; p.on('dialog', d => { p.__alertes.push(d.message()); d.accept(); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  return p;
}
const RESUME = 'num_controle;date_controle;lait_total;nb_brebis\n1;20/01/2027;1500;10\n2;20/02/2027;1400;10\n3;20/03/2027;1200;10\n';
const CAHIER = 'numero_visuel_sieol;ano_repro;ctl1_ml;ctl1_anomalie;ctl2_ml;ctl2_anomalie;ctl3_ml;ctl3_anomalie\n601;;1500;;1400;;1300;10\n602;10;;;;;;\n603;;;;;;;10\n604;;;;;;;10\n605;;1450;;1350;;;10\n606;;0;09;;;0;\n';

// 1. règles pures
{
  const p = await ouvrir(true);
  eq(await p.evaluate(() => libelleAnomalieControle(10)), 'Vide définitive', 'code 10 = « Vide définitive »');
  eq(await p.evaluate(() => [parseCelluleControleLaitierModele('1400/10').invalide, parseCelluleControleLaitierModele('10'), parseCelluleControleLaitierModele('09'), parseCelluleControleLaitierModele('11'), parseCelluleControleLaitierModele('12'), parseCelluleControleLaitierModele('03').invalide, parseCelluleControleLaitierModele('0/10'), parseCelluleControleLaitierModele('0/08'), parseCelluleControleLaitierModele('0').present === false, parseCelluleControleLaitierModele('0/01').invalide].map(x => x === true ? true : (x.quantite === undefined ? x : [x.quantite, x.anomalie]))),
    [true, [null, 10], [null, 9], [null, 11], [12, null], true, [null, 10], [null, 8], true, true], 'modèle Excel : 0 de lait = pas de lait (« 0/10 », « 0/08 » = code seul, « 0 » = case vide, « 0/01 » invalide) ; « 1400/10 » refusé (jamais de lait avec le code 10) ; code seul sans barre : « 10 », « 09 », « 11 » ; « 12 » = 12 mL ; un code jamais seul invalide');
  await p.context().close();
}
// 2. import SIEOL : aperçu, rien d'office, puis cases cochées
{
  const p = await ouvrir(true);
  await p.evaluate(() => render('import-controle-laitier-sieol'));
  await p.selectOption('#import-cl-campagne', '2026');
  await p.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from(RESUME) });
  await p.setInputFiles('#import-cl-cahier-file', { name: 'cahier.csv', mimeType: 'text/csv', buffer: Buffer.from(CAHIER) });
  await p.waitForSelector('#carte-code10');
  const carte = await p.evaluate(() => ({
    t: document.getElementById('carte-code10').textContent.replace(/\s+/g, ' '),
    aMarquer: (document.getElementById('code10-a-marquer') || {}).textContent.replace(/\s+/g, ' '),
    lait: [...document.querySelectorAll('.code10-lait-bloc')].map(e => e.textContent.replace(/\s+/g, ' ')),
    cases: [...document.querySelectorAll('#carte-code10 input[type=checkbox]')].map(c => c.checked)
  }));
  check(/2 brebis en code 10, pas encore marquées vides dans Ovilog/.test(carte.aMarquer) && /n°602 · n°604/.test(carte.aMarquer) && !/anomalie repro|C3/.test(carte.aMarquer), 'à marquer : n°602 et n°604, sans source : ' + carte.aMarquer);
  check(carte.lait.length === 1 && /n°605/.test(carte.lait[0]) && /code 10 au C3/.test(carte.lait[0]) && /1\s450\smL au C1/.test(carte.lait[0]) && /1\s350\smL au C2/.test(carte.lait[0]), 'code 10 avec du lait : n°605, source et lait montrés : ' + JSON.stringify(carte.lait));
  check(/Déjà marquée vide définitive : n°603 \(rien n'est changé\)/.test(carte.t) && /sans code 10 dans le fichier : n°606/.test(carte.t), 'déjà marquée (603) et marquée sans code (606) en ligne grise : ' + carte.t);
  check(!/cotée/i.test(carte.t), 'jamais « cotée », toujours « code 10 »');
  const rejet = await p.evaluate(() => (document.getElementById('import-cl-rejets10') || {}).textContent || '');
  check(/Lait et code 10 sur un même contrôle : impossible, contrôle laissé de côté/.test(rejet) && /n°601 C3 : 1\s300\smL/.test(rejet), 'SIEOL : lait + code 10 sur un même contrôle refusé et montré : ' + rejet);
  eq(carte.cases, [false, false], 'cases décochées d\'office');
  if (CAP) { await p.evaluate(() => document.getElementById('carte-code10').scrollIntoView({ block: 'center' })); await (await p.$('#carte-code10')).screenshot({ path: path.join(CAP, 'apres_import_code10.png') }); }
  check(await p.evaluate(() => window.__saves === 0), 'aperçu : rien n\'est écrit');
  await p.click('#btn-confirm-import-cl');
  await p.waitForFunction(() => window.__saves > 0);
  const r = await p.evaluate(() => {
    const b = c => DB.brebis.find(x => x.numeroCourtTravailSieol === c);
    return { c601: b('601').controleLaitier.map(c => c.controle), vides: DB.brebis.filter(x => estVideDefinitiveCampagneN(x, 2026)).map(x => x.numeroCourtTravailSieol), c604: b('604').controleLaitier, c605: b('605').controleLaitier.map(c => [c.controle, c.quantite, c.anomalie]) };
  });
  eq(r.vides, ['603', '606'], 'rien coché : aucune brebis marquée');
  eq(r.c601, [1, 2], 'SIEOL : le contrôle lait + code 10 (C3) n\'est pas importé');
  eq(r.c604.map(c => [c.controle, c.quantite, c.anomalie]), [[3, null, 10]], 'SIEOL : contrôle à code seul gardé (quantité vide, code 10)');
  eq(r.c605, [[1, 1450, null], [2, 1350, null], [3, null, 10]], 'SIEOL : lait et code seul gardés');
  eq(await p.evaluate(() => DB.brebis.find(x => x.numeroCourtTravailSieol === '606').controleLaitier.map(c => [c.controle, c.quantite, c.anomalie])), [[1, null, 9]], 'SIEOL : « 0 » + code 09 = code sans lait ; « 0 » sans code = rien');
  // deuxième import : les deux cases cochées
  await p.evaluate(() => render('import-controle-laitier-sieol'));
  await p.selectOption('#import-cl-campagne', '2026');
  await p.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from(RESUME) });
  await p.setInputFiles('#import-cl-cahier-file', { name: 'cahier.csv', mimeType: 'text/csv', buffer: Buffer.from(CAHIER) });
  await p.waitForSelector('#carte-code10 .code10-tous');
  await p.check('#carte-code10 .code10-tous'); await p.check('#carte-code10 .code10-lait');
  await p.click('#btn-confirm-import-cl');
  await p.waitForFunction(() => DB.brebis.filter(x => estVideDefinitiveCampagneN(x, 2026)).length === 5);
  eq(await p.evaluate(() => DB.brebis.filter(x => estVideDefinitiveCampagneN(x, 2026)).map(x => x.numeroCourtTravailSieol).sort()), ['602', '603', '604', '605', '606'], 'cases cochées : 602, 604 et 605 marquées, 603 inchangée');
  check(p.__alertes.some(m => /3 brebis marquée\(s\) vide définitive/.test(m)), 'message de fin : brebis marquées : ' + JSON.stringify(p.__alertes));
  eq(await p.evaluate(() => DB.brebis.find(x => x.numeroCourtTravailSieol === '603').videesDefinitives), [{ campagne: 2026, date: '2026-12-01' }], 'déjà marquée : marque d\'origine intacte');
  await p.context().close();
}
// 3. modèle Excel Ovilog : même carte, codes 10 lus, C4 seul accepté
{
  const p = await ouvrir(true);
  const xlsx = await p.evaluate(async () => {
    const rows = [['Modèle'], [''], [''], ['', '', '20/01/2027', '20/02/2027', '20/03/2027', '20/04/2027'], ['EID', 'SIEOL', 'Contrôle 1', 'Contrôle 2', 'Contrôle 3', 'Contrôle 4'], ['', '602', '', '', '', '10'], ['', '605', '1450', '1350', '', '10'], ['', '601', '', '', '', '1100']];
    return Array.from(await buildXlsxWorkbook([{ name: CONTROLE_LAITIER_MODELE_SHEET, rows }]));
  });
  await p.evaluate(() => render('import-controle-laitier-modele'));
  await p.setInputFiles('#import-cl-modele-file', { name: 'modele.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(xlsx) });
  await p.waitForSelector('#carte-code10');
  const t = await p.evaluate(() => ({ a: (document.getElementById('code10-a-marquer') || {}).textContent.replace(/\s+/g, ' '), l: [...document.querySelectorAll('.code10-lait-bloc')].map(e => e.textContent.replace(/\s+/g, ' ')), visible: !document.getElementById('btn-confirm-import-cl-modele').classList.contains('hidden') }));
  check(/1 brebis en code 10, pas encore marquée vide/.test(t.a) && /n°602/.test(t.a), 'modèle : n°602 à marquer : ' + t.a);
  check(t.l.length === 1 && /n°605/.test(t.l[0]) && /code 10 au C4/.test(t.l[0]), 'modèle : n°605 code 10 avec du lait : ' + JSON.stringify(t.l));
  check(t.visible, 'modèle : « Confirmer » visible (des mesures au C4 seulement comptent)');
  await p.check('#carte-code10 .code10-tous');
  await p.click('#btn-confirm-import-cl-modele');
  await p.waitForFunction(() => window.__saves > 0);
  const r = await p.evaluate(() => ({ vides: DB.brebis.filter(x => estVideDefinitiveCampagneN(x, 2026)).map(x => x.numeroCourtTravailSieol).sort(), c601: DB.brebis.find(x => x.numeroCourtTravailSieol === '601').controleLaitier.map(c => [c.controle, c.quantite]), c602: DB.brebis.find(x => x.numeroCourtTravailSieol === '602').controleLaitier.map(c => [c.controle, c.quantite, c.anomalie]) }));
  eq(r.vides, ['602', '603', '606'], 'modèle : seule la case cochée (602) est marquée, 605 (lait) non');
  eq(r.c601, [[4, 1100]], 'modèle : une mesure au C4 seul est écrite');
  eq(r.c602, [[4, null, 10]], 'modèle : code 10 seul écrit au C4');
  await p.context().close();
}
// 4. fiche brebis : n° de lactation dans Index, « sans lait » dans Contrôles
{
  const p = await ouvrir(false);
  await p.evaluate(() => {
    DB.cahierControleLaitier = [{ eid: DB.brebis[0].eid, campagne: 2026, numLactation: '3' }, { eid: DB.brebis[1].eid, campagne: 2025, numLactation: '1' }];
    DB.brebis[0].controleLaitier = [{ controle: 1, quantite: 1500, campagne: 2026, date: '2027-01-20' }, { controle: 3, quantite: null, anomalie: 9, campagne: 2026, date: '2027-03-20' }];
    render('detail', DB.brebis[0].id);
  });
  await p.evaluate(() => [...document.querySelectorAll('#app button')].find(x => x.textContent.trim() === 'Contrôles').click());
  const ctrl = await p.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
  check(!/N° de lactation/.test(ctrl) && /sans lait/.test(ctrl) && !/null mL/.test(ctrl), 'Contrôles : plus de n° de lactation, « sans lait » pour un code seul');
  await p.evaluate(() => [...document.querySelectorAll('#app button')].find(x => x.textContent.trim() === 'Index').click());
  eq(await p.evaluate(() => [...document.getElementById('index-num-lactation').children].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' ')), 'N° de lactation 3e lactation', 'Index : « 3e lactation »');
  if (CAP) await p.screenshot({ path: path.join(CAP, 'apres_fiche_index.png') });
  await p.evaluate(() => render('detail', DB.brebis[1].id));
  await p.evaluate(() => [...document.querySelectorAll('#app button')].find(x => x.textContent.trim() === 'Index').click());
  eq(await p.evaluate(() => [...document.getElementById('index-num-lactation').children].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' ')), 'N° de lactation 1re lactation (campagne 2026)', 'Index : campagne précisée quand ce n\'est pas la campagne en cours');
  await p.evaluate(() => render('detail', DB.brebis[2].id));
  await p.evaluate(() => [...document.querySelectorAll('#app button')].find(x => x.textContent.trim() === 'Index').click());
  check(await p.evaluate(() => !document.getElementById('index-num-lactation')), 'Index : rien sans n° de lactation connu');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « CODE 10 · VIDE DÉFINITIVE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
