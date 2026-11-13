/* Nombre de contrôles laitiers adaptatif (PC et mobile, partout) : colonnes C1 au plus grand contrôle présent dans la campagne, jamais plus
   (nbControlesCampagne, numerosControles) ; maximum du type de suivi CLS 4, CLO 7, sinon 8 (maxControlesSuivi, message ambre au-delà, jamais
   bloquant) ; mobile : cartes C1 à Cn (4 par ligne, « mL » une seule fois) ; PC : colonne du n° fixe quand les contrôles défilent (Contrôle
   laitier, Lots) ; exports PDF / Excel C1 à Cn ; import SIEOL : contrôles trouvés dans les fichiers (cochés d'office), ctl1 à ctl8, seul le
   n° de lactation repris du cahier (rien d'effacé) ; modèle Excel Ovilog C1 à C8 repérés par leur titre ; rang de lactation plus montré au tri
   des agnelles. saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const prep = ([nb, type]) => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', typeSuivi: type });
  const E = n => '2500000456' + n;
  DB.brebis = ['601', '602', '603'].map((c, i) => ({ id: 'b' + i, eid: E(String(20101 + i)), numeroCourtTravailSieol: c, statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [], modesRepro: [],
    agnelages: [{ date: '2026-10-1' + i, campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', statutFinal: 'vendu' }] }],
    controleLaitier: Array.from({ length: nb }, (_, k) => ({ controle: k + 1, quantite: 1500 - k * 100 + i * 10, anomalie: null, date: '2026-11-' + String(10 + k).padStart(2, '0'), campagne: 2026 })) }));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.resumeControleLaitier = []; DB.cahierControleLaitier = [];
};
const ouvrir = async (mobile, nb, type) => {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 }, acceptDownloads: false });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-12-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep, [nb, type]);
  return p;
};

// 1. la règle
{
  const p = await ouvrir(false, 4, 'cls');
  eq(await p.evaluate(() => [nbControlesCampagne(), numerosControles(), maxControlesSuivi()]), [4, [1, 2, 3, 4], 4], 'CLS, 4 contrôles : C1 à C4, maximum 4');
  await p.evaluate(prep, [7, 'clo']);
  eq(await p.evaluate(() => [nbControlesCampagne(), maxControlesSuivi()]), [7, 7], 'CLO, 7 contrôles : C1 à C7, maximum 7');
  await p.evaluate(prep, [0, null]);
  eq(await p.evaluate(() => [nbControlesCampagne(), maxControlesSuivi()]), [3, 8], 'aucun contrôle : 3 colonnes vides comme avant ; suivi non défini : maximum 8');
  await p.evaluate(() => { DB.brebis[0].controleLaitier = [{ controle: 2, quantite: 900, campagne: 2025 }]; DB.registre.brebis['x'] = { controleLaitier: [{ controle: 5, quantite: 800, campagne: 2026 }] }; });
  eq(await p.evaluate(() => nbControlesCampagne()), 5, 'registre compris, autre campagne ignorée');
  await p.context().close();
}
// 2. mobile : cartes C1 à C4, « mL » une seule fois, filtres C1 à C4
{
  const p = await ouvrir(true, 4, 'cls');
  await p.evaluate(() => render('controle-laitier')); await p.waitForTimeout(200);
  const m = await p.evaluate(() => ({
    ligne: document.getElementById('cl-ligne-imports').textContent,
    cartes: [...document.querySelectorAll('#cl-table .cl-carte')].map(c => [...c.querySelectorAll('.cl-val-l')].map(e => e.textContent)),
    unites: document.querySelectorAll('#cl-table .cl-val-u').length,
    pills: [...document.querySelectorAll('.ctrl-filtre-opt')].map(b => b.textContent),
    tuiles: [...document.querySelectorAll('#cl-tuiles .reg-tuile-l')].map(e => e.textContent),
    deborde: [...document.querySelectorAll('#cl-table .cl-val-v')].some(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth)
  }));
  check(/4 contrôles cette campagne · suivi CLS : jusqu'à 4 · quantités en mL/.test(m.ligne), 'mobile : ligne grise : ' + m.ligne);
  check(m.cartes.length === 3 && m.cartes.every(c => JSON.stringify(c) === '["C1","C2","C3","C4"]'), 'mobile : cartes C1 à C4 : ' + JSON.stringify(m.cartes));
  eq(m.unites, 0, 'mobile : « mL » plus répété à chaque quantité');
  eq(m.pills, ['C1', 'C2', 'C3', 'C4'], 'mobile : filtres C1 à C4');
  eq(m.tuiles, ['Brebis contrôlées', 'Moyenne C1', 'Moyenne C2', 'Moyenne C3', 'Moyenne C4'], 'mobile : tuiles des moyennes C1 à C4');
  check(!m.deborde, 'mobile : aucune quantité coupée ni hors de l\'écran');
  await p.evaluate(prep, [7, 'clo']); await p.evaluate(() => render('controle-laitier')); await p.waitForTimeout(200);
  check(await p.evaluate(() => [...document.querySelector('#cl-table .cl-carte').querySelectorAll('.cl-val-l')].map(e => e.textContent).join() === 'C1,C2,C3,C4,C5,C6,C7' && getComputedStyle(document.querySelector('#cl-table .cl-vals')).gridTemplateColumns.split(' ').length === 4), 'mobile : 7 contrôles = C1 à C7, 4 par ligne');
  await p.context().close();
}
// 3. PC : colonnes C1 à Cn, n° fixe, moyennes, exports, Lots
{
  const p = await ouvrir(false, 7, 'clo');
  await p.setViewportSize({ width: 1000, height: 900 });
  await p.evaluate(() => render('controle-laitier')); await p.waitForTimeout(300);
  const t = await p.evaluate(() => ({
    th: [...document.querySelectorAll('#cl-table th')].map(e => e.textContent.replace(/[▲▼]/g, '').trim()).filter(Boolean),
    kpi: [...document.querySelectorAll('.pc-kpis .pc-kpi-l, .pc-kpis [class*="kpi"] .l')].length,
    sticky: getComputedStyle(document.querySelector('#cl-table td.num-fixe')).position,
    cadre: getComputedStyle(document.querySelector('.tab-num-fixe')).overflowX,
    sub: document.querySelector('.brd-sub').textContent
  }));
  eq(t.th, ['N° court', 'MàB', 'C1 (mL)', 'C2 (mL)', 'C3 (mL)', 'C4 (mL)', 'C5 (mL)', 'C6 (mL)', 'C7 (mL)'], 'PC : colonnes C1 à C7');
  eq([t.sticky, t.cadre], ['sticky', 'auto'], 'PC : le n° reste visible quand les contrôles défilent');
  check(/7 contrôles cette campagne · suivi CLO : jusqu'à 7/.test(t.sub), 'PC : sous-titre : ' + t.sub);
  // le n° reste en place après un défilement latéral
  const pos = await p.evaluate(() => { const z = document.querySelector('.tab-num-fixe'); const c = document.querySelector('#cl-table td.num-fixe'); const x0 = c.getBoundingClientRect().left; z.scrollLeft = 400; return [x0, c.getBoundingClientRect().left, z.scrollLeft]; });
  check(pos[2] > 0 ? Math.abs(pos[0] - pos[1]) < 1 : true, 'PC : n° fixe au défilement : ' + JSON.stringify(pos));
  // exports : mêmes colonnes C1 à C7
  const ex = await p.evaluate(async () => {
    const o1 = buildPdfTableCharte, o2 = buildXlsxWorkbook, o3 = saveOrShareBinaryFile; let pdf = null, xl = null;
    buildPdfTableCharte = (o) => { pdf = o.columns.map(c => c.label); return new Uint8Array([1]); };
    buildXlsxWorkbook = async (sh) => { xl = sh[0].rows[0]; return new Uint8Array([1]); };
    saveOrShareBinaryFile = async () => {};
    const rows = DB.brebis.map(s => ({ courtSieol: s.numeroCourtTravailSieol, dateMab: null, ...Object.fromEntries(s.controleLaitier.map(c => ['c' + c.controle, c.quantite])) }));
    await exportControleLaitierPdf(rows); await exportControleLaitierXlsx(rows);
    buildPdfTableCharte = o1; buildXlsxWorkbook = o2; saveOrShareBinaryFile = o3;
    return { pdf, xl };
  });
  const attendu = ['N° court', 'Date de mise bas', 'C1 (mL)', 'C2 (mL)', 'C3 (mL)', 'C4 (mL)', 'C5 (mL)', 'C6 (mL)', 'C7 (mL)'];
  eq(ex.pdf, attendu, 'export PDF : C1 à C7'); eq(ex.xl, attendu, 'export Excel : C1 à C7');
  // Lots PC, onglet contrôles
  const lot = await p.evaluate(() => {
    DB.lots = [{ id: 'L1', nom: 'Lot essai', type: 'recherche', membres: [], dateCreation: '2026-12-01' }];
    lotsPcEtat = lotsPcEtatInitial(); lotsPcEtat.F = filtresLotsVides();
    const l = lignesLotsPc(DB.lots[0]);
    return { lait: l[0].lait.length, an: l[0].anomalie.length, tri: cleTriLotsPc(l[0], 'lait7'), tri3: cleTriLotsPc(l[0], 'lait3') };
  });
  eq([lot.lait, lot.an, lot.tri, lot.tri3], [7, 7, 900, 1300], 'Lots PC : lait et anomalies C1 à C7, tri par colonne');
  await p.context().close();
}
// 4. import SIEOL : contrôles trouvés seuls, ambre au-delà, n° de lactation seul repris
{
  const p = await ouvrir(false, 0, 'cls');
  await p.evaluate(() => { DB.cahierControleLaitier = [{ eid: DB.brebis[0].eid, campagne: 2026, classeParQuart: 2, lactMoyen: 300, anoLact: 'X', numLactation: '1' }]; render('import-controle-laitier-sieol'); });
  await p.waitForSelector('#import-cl-resume-file');
  check(await p.evaluate(() => document.getElementById('import-cl-controles').classList.contains('hidden') && !document.querySelector('.cl-controle-opt')), 'SIEOL : aucun contrôle à choisir avant les fichiers');
  await p.selectOption('#import-cl-campagne', '2026');
  const entete = 'numero_visuel_sieol;' + [1, 2, 3, 4, 5].map(n => `ctl${n}_ml;ctl${n}_anomalie`).join(';') + ';num_lactation;classe_par_quart;lact_moyen;ano_lact';
  await p.setInputFiles('#import-cl-cahier-file', { name: 'cahier.csv', mimeType: 'text/csv', buffer: Buffer.from(entete + '\n601;1500;;1400;;1300;;1200;;1100;;3;4;250;Y\n602;1490;;1390;;1290;;1190;;;;2;1;200;\n') });
  await p.waitForSelector('#import-cl-controles:not(.hidden)');
  const z = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#import-cl-controles .cl-controle-opt')].map(b => b.textContent + (b.classList.contains('selected') ? '*' : '')), audela: document.getElementById('import-cl-au-dela') && document.getElementById('import-cl-au-dela').textContent }));
  eq(z.chips, ['C1*', 'C2*', 'C3*', 'C4*', 'C5*'], 'SIEOL : contrôles trouvés dans le cahier, cochés d\'office (ctl1 à ctl5)');
  check(/5 contrôles dans le fichier, le suivi CLS en prévoit 4/.test(z.audela || ''), 'SIEOL : message ambre au-delà du maximum CLS : ' + z.audela);
  await p.click('#import-cl-controles .cl-controle-opt[data-controle="5"]');
  check(await p.evaluate(() => !document.querySelector('#import-cl-controles .cl-controle-opt[data-controle="5"]').classList.contains('selected')), 'SIEOL : un contrôle se décoche');
  await p.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from('num_controle;date_controle;lait_total;nb_brebis\n1;10/11/2026;1500;3\n2;11/11/2026;1400;3\n3;12/11/2026;1300;3\n4;13/11/2026;1200;3\n') });
  await p.waitForTimeout(300);
  eq(await p.evaluate(() => [...document.querySelectorAll('#import-cl-controles .cl-controle-opt')].map(b => b.textContent + (b.classList.contains('selected') ? '*' : ''))), ['C1*', 'C2*', 'C3*', 'C4*', 'C5'], 'SIEOL : le décoché reste décoché quand le résumé arrive');
  await p.waitForSelector('#btn-confirm-import-cl:not(.hidden)');
  await p.click('#btn-confirm-import-cl'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ c601: DB.brebis[0].controleLaitier.map(c => c.controle).sort(), c602: DB.brebis[1].controleLaitier.map(c => c.controle).sort(), cahier: DB.cahierControleLaitier.map(c => Object.assign({}, c, { eid: undefined })) }));
  eq([r.c601, r.c602], [[1, 2, 3, 4], [1, 2, 3, 4]], 'SIEOL : C1 à C4 écrits, C5 décoché non repris');
  eq(r.cahier, [{ campagne: 2026, classeParQuart: 2, lactMoyen: 300, anoLact: 'X', numLactation: '3' }, { campagne: 2026, numLactation: '2' }], 'SIEOL : seul le n° de lactation est repris du cahier ; les autres champs déjà enregistrés restent tels quels');
  await p.context().close();
}
// 5. modèle Excel Ovilog : colonnes repérées par leur titre, C1 à C8
{
  const p = await ouvrir(false, 0, 'cls');
  const m = await p.evaluate(() => {
    const vide = Array(10).fill('');
    const rows = [vide, vide, vide, ['', '', '10-11-2026', '11-11-2026', '12-11-2026', '13-11-2026', '', '', '', ''],
      ['Numéro EID complet (11 chiffres)', 'Numéro SIEOL (court ou long)', ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => 'Contrôle ' + n + ' (mL[/code])')],
      ['', '601', '1500', '1400', '1300', '1200', '', '', '', '']];
    const r = parserFichierControleLaitierModele(rows);
    const ancien = parserFichierControleLaitierModele([vide, vide, vide, ['', '', '10-11-2026', '11-11-2026', '12-11-2026'], ['A', 'B', 'x', 'y', 'z'], ['', '601', '1500', '1400', '1300']]);
    return { ns: Object.keys(r.datesFichier).map(Number), c4: r.lignes[0].controles[4].quantite, d4: r.datesFichier[4], ancien: Object.keys(ancien.datesFichier).map(Number), ancienC3: ancien.lignes[0].controles[3].quantite };
  });
  eq([m.ns, m.c4, m.d4], [[1, 2, 3, 4, 5, 6, 7, 8], 1200, '2026-11-13'], 'modèle Excel : C1 à C8 repérés par leur titre, C4 lu');
  eq([m.ancien, m.ancienC3], [[1, 2, 3], 1300], 'ancien modèle (sans titres lisibles) : C1 à C3 comme avant');
  await p.context().close();
}
// 6. rang de lactation plus montré au tri des agnelles ; fiche : n° de lactation seul
{
  const p = await ouvrir(true, 3, 'cls');
  const t = await p.evaluate(() => {
    DB.cahierControleLaitier = [{ eid: DB.brebis[0].eid, campagne: 2025, numLactation: '4', classeParQuart: 2, lactMoyen: 300 }, { eid: DB.brebis[0].eid, campagne: 2026, numLactation: '5', classeParQuart: 3, lactMoyen: 280, anoLact: 'Z' }];
    const info = infoMereAgnelle(DB.brebis[0].eid, null, null);
    render('detail', DB.brebis[0].id);
    return { rang: info.rangLactation, fiche: document.getElementById('app').textContent };
  });
  eq(t.rang, null, 'tri des agnelles : rang de lactation plus montré');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.tab-btn, [data-tab]')].find(x => /Contr/.test(x.textContent)); if (b) b.click(); });
  const fiche = await p.evaluate(() => document.getElementById('app').textContent);
  check(!/Classe par quart|Estimation lactation \(UNOTEC\)|Anomalie lactation : Z/.test(fiche), 'fiche : classe provisoire, estimation et anomalie de lactation du cahier plus affichées');
  await p.context().close();
}
await browser.close();
console.log('OK test_controles_adaptatifs');
