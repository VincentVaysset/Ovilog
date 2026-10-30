/* Paternité des IA (CLS) : le papier de l'inséminateur recopié dans le modèle Excel Ovilog (onglets « Béliers » : code IA, n° officiel, ISOL ;
   « Brebis inséminées » : n° brebis, code IA), importé sur PC pour un lot IA choisi. Couvre : normalisation, lecture des anciens blocs, aperçu et
   garde-fous (code inconnu, bélier mal renseigné, hors lot, introuvable, paternité inconnue, doublon), rien d'écrit avant « Enregistrer »,
   « Remplacer » ligne par ligne, le père qui suit les agneaux (déjà nés ou à naître), la généalogie (mère : classe et lactation d'avant la naissance ;
   père : n° officiel et ISOL), l'ISOL du père au tri des agnelles (PC triable, mobile, export) et dans le panneau du lot IA, plus de carte
   « Paternité de l'IA ». saveData REMPLACÉ ; jeu synthétique (indicatifs 000456 / 000012), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1100 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', typeSuivi: 'cls' });
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = n => ({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [1, 2, 3, 4, 5, 6].map(fiche); DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.lots = [{ id: 'LIA', type: 'reproduction', nom: 'IA octobre', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026, membres: [1, 2, 3, 4, 5].map(E) }];
    DB.brebis.forEach(b => { if (+b.id.slice(1) <= 5) b.modesRepro.push({ date: '2026-10-20', mode: 'IA', lotId: 'LIA', campagne: 2026 }); });
    DB.lactationModele = [{ eid: E(1), campagne: 2025, classeParQuart: 2, lactationTotale: 312 }];
    // brebis 1 : déjà mis bas (IA) avant l'import, une femelle et un mâle
    DB.brebis[0].agnelages = [{ date: '2027-03-17', campagne: 2026, codeRepro: 'IA', lambs: [{ sexe: 'Femelle', adopte: false, eid: '250000004561001', sanitaire: [] }, { sexe: 'Mâle', adopte: false, eid: '250000004561002', sanitaire: [] }] }];
    window.__eids = JSON.stringify(DB.brebis.map(b => b.eid));
  });
  return page;
}
const xlsx = (page, beliers, brebis) => page.evaluate(async ([be, br]) => Array.from(await buildXlsxWorkbook([
  { name: 'Béliers', rows: [['Code IA', 'N° officiel', 'ISOL']].concat(be) }, { name: 'Brebis inséminées', rows: [['N° brebis', 'Code IA']].concat(br) }])), [beliers, brebis]);
async function importer(page, beliers, brebis) {
  await page.evaluate(() => render('import-inseminations'));
  await page.selectOption('#import-ia-lot', 'LIA');
  await page.setInputFiles('#import-ia-file', { name: 'ia.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await xlsx(page, beliers, brebis)) });
  await page.waitForSelector('#import-ia-table');
}
const etats = page => page.evaluate(() => [...document.querySelectorAll('#import-ia-table tbody tr')].map(tr => [tr.cells[0].textContent, tr.dataset.etat]));
const tuiles = page => page.evaluate(() => [...document.querySelectorAll('#import-ia-tuiles .tuile-pc')].map(t => t.querySelector('.brd-kpi-l').textContent + ' ' + t.querySelector('.brd-kpi-v').textContent));

// ================================================================ 1. normalisation et anciens blocs
const p = await ouvrir(true);
eq(await p.evaluate(() => [
  normaliserPaterniteIa({ pereCourt: '40518', pereNumero: 'FR 000012 40518', indexIsol: '112,5' }),
  normaliserPaterniteIa({ pereCourt: '040518', pereNumero: '00001240518', indexIsol: '' }).ia,
  normaliserPaterniteIa({ pereCourt: '', pereNumero: '00001240518' }).erreur,
  normaliserPaterniteIa({ pereCourt: '40518', pereNumero: '' }).erreur,
  normaliserPaterniteIa({ pereCourt: '40518', pereNumero: '00001240518', indexIsol: 'élevé' }).erreur]),
  [{ ia: { pereCourt: '40518', pereNumero: '00001240518', indexIsol: 112.5, source: 'import' } }, { pereCourt: '040518', pereNumero: '00001240518', source: 'import' }, 'code IA absent', 'n° officiel absent', 'ISOL « élevé » : un nombre (ex. 112 ou 112,5)'],
  'normalisation : code IA et n° officiel obligatoires, « FR » et espaces retirés, ISOL facultatif à virgule');
eq(await p.evaluate(() => [paterniteIaPereTexte({ pereCourt: '40518', pereNumero: '00001240518' }), paterniteIaIndexTexte({ pereCourt: '40518', pereNumero: '00001240518', indexIsol: 98 }),
  paterniteIaPereTexte({ orientation: 'lait', paternite: 'inconnue' }), paterniteIaPereTexte({ orientation: 'lait', paternite: 'connue', pereNumero: '00099900001', pereNom: 'Bélier A' })]),
  ['FR 000012 40518', 'ISOL 98', null, 'FR 000999 00001'], 'affichage : n° officiel, ISOL ; ancien bloc « inconnue » = pas de père, ancien nom plus affiché');

// ================================================================ 2. import : aperçu et garde-fous, rien d'écrit avant « Enregistrer »
const avant = await p.evaluate(() => JSON.stringify(DB));
await importer(p, [['40518', 'FR 000012 40518', '112,5'], ['40731', '00001240731', '98'], ['40999', 'abc', '']],
  [['69001', '40518'], ['69002', '040731'], ['69002', '40731'], ['69003', ''], ['69004', '40815'], ['69005', '40999'], ['69006', '40518'], ['69099', '40518']]);
eq(await etats(p), [['n°69001', 'relie'], ['n°69002', 'relie'], ['n°69003', 'inconnue'], ['n°69004', 'codeInconnu'], ['n°69005', 'belierInvalide'], ['n°69006', 'horsLot'], ['69099', 'introuvable']],
  'aperçu : reliée (zéros de tête ignorés, doublon identique fusionné), paternité inconnue, code inconnu, bélier mal renseigné, hors lot, introuvable');
eq(await tuiles(p), ['brebis reliées à un père 2', 'à vérifier 4', 'paternité inconnue 1', 'béliers utilisés 2'], 'tuiles de l\'aperçu');
check(/absente du lot « IA octobre »[\s\S]*ligne \d+ ignorée/.test(await p.evaluate(() => document.getElementById('import-ia-alertes').textContent)), 'message ambre pour chaque ligne laissée de côté');
check(await p.evaluate(a => JSON.stringify(DB) === a, avant), 'rien n\'est écrit avant « Enregistrer »');
await p.click('#btn-confirm-import-ia');
check(/2 brebis reliées à leur père/.test(await p.evaluate(() => document.getElementById('import-ia-ok').textContent)), 'message de fin');
eq(await p.evaluate(() => [DB.brebis[0].modesRepro[0].ia, DB.brebis[1].modesRepro[0].ia, DB.brebis[2].modesRepro[0].ia || null, DB.brebis[5].modesRepro.length]),
  [{ pereCourt: '40518', pereNumero: '00001240518', indexIsol: 112.5, source: 'import' }, { pereCourt: '40731', pereNumero: '00001240731', indexIsol: 98, source: 'import' }, null, 0],
  'écrit sur l\'IA du lot : n° officiel, code, ISOL ; paternité inconnue et hors lot non touchées');
eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs.map(l => [l.pere, l.pereIa && l.pereIa.indexIsol])), [['FR 000012 40518', 112.5], ['FR 000012 40518', 112.5]], 'agneaux déjà nés : le père suit');

// ================================================================ 3. autre père : remplacé seulement sur case cochée
await importer(p, [['40731', '00001240731', '98']], [['69001', '40731'], ['69002', '40731']]);
eq(await etats(p), [['n°69001', 'conflit'], ['n°69002', 'aJour']], 'réimport : autre père = conflit, même père = déjà à jour');
check(await p.evaluate(() => document.getElementById('btn-confirm-import-ia').disabled), 'rien à enregistrer tant que « Remplacer » n\'est pas cochée');
await p.check('.import-ia-remplacer');
await p.click('#btn-confirm-import-ia');
eq(await p.evaluate(() => [DB.brebis[0].modesRepro[0].ia.pereCourt, DB.brebis[0].agnelages[0].lambs[0].pere, DB.brebis[0].agnelages[0].lambs[0].pereIa.indexIsol]), ['40731', 'FR 000012 40731', 98], '« Remplacer » : nouveau père, agneaux mis à jour');

// ================================================================ 4. mise bas après l'import : le père se pose seul
await p.evaluate(() => { const b = DB.brebis[1], r = construireAgnelageMiseBas(b, { date: '2027-03-18', codeRepro: 'IA', lambs: [{ sexe: 'Femelle', eid: '250000004561003' }] }); enregistrerMiseBas(b, r.agnelage); });
eq(await p.evaluate(() => DB.brebis[1].agnelages[0].lambs[0].pere), 'FR 000012 40731', 'mise bas IA saisie après l\'import : le père est posé sur l\'agneau');

// ================================================================ 5. généalogie : mère (classe, lactation d'avant la naissance), père (n° officiel, ISOL)
const gen = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = genealogieNaissanceHtml(DB.brebis[0].agnelages[0].lambs[0], E(1), 2026, null); return d.textContent.replace(/\s+/g, ' '); });
check(/Mère\s*n°69001\s*Classe 2 · Lactation \S+ : 312 L\s*Père \(IA\)\s*FR 000012 40731\s*ISOL 98/.test(gen), 'généalogie : ' + gen);
check(await p.evaluate(() => !genealogieNaissanceHtml({ pere: 'Bélier <b>' }, null, null, null).includes('<b>')), 'père déclaré à la main : texte échappé');

// ================================================================ 6. tri des agnelles PC : colonne « ISOL père » triable, export
await p.evaluate(() => { triPcEtat = null; render('agnelles'); });
await p.waitForSelector('#pc-tri-agnelles');
check(/ISOL père/.test(await p.evaluate(() => document.querySelector('#pc-tri-agnelles table tr').textContent)), 'tri PC : en-tête « ISOL père »');
eq(await p.evaluate(() => [...document.querySelectorAll('#pc-tri-agnelles table tr[data-eid]')].map(tr => [tr.cells[0].textContent, tr.cells[tr.cells.length - 1].textContent])), [['61001', '98'], ['61003', '98']], 'tri PC : ISOL du père par agnelle');
await p.click('.ta-tri-col[data-cle="isolPere"]');
check(/ISOL père ▼/.test(await p.evaluate(() => document.querySelector('#pc-tri-agnelles table tr').textContent)), 'tri PC : clic = tri par ISOL');
eq(await p.evaluate(() => { const t = triExportTableau('aTrier', triAgnellesDonnees().aTrier); return [t.entete[t.entete.length - 1], t.lignes.map(l => l[l.length - 1])]; }), ['ISOL père', ['98', '98']], 'export du tri : colonne ISOL père');

// ================================================================ 7. panneau du lot IA (PC) : père et ISOL
await p.evaluate(() => { lotsPcEtat = lotsPcEtatInitial(); lotsPcEtat.lotId = 'LIA'; render('lots'); });
await p.waitForSelector('#lt-membres');
eq(await p.evaluate(() => [...document.querySelectorAll('#lt-membres tr[data-eid]')].map(tr => [tr.cells[0].textContent, tr.querySelector('.lt-pere').textContent, tr.querySelector('.lt-isol').textContent])),
  [['69001', '000012 40731', '98'], ['69002', '000012 40731', '98'], ['69003', '—', '—'], ['69004', '—', '—'], ['69005', '—', '—']], 'panneau du lot IA : père et ISOL de chaque brebis');

// ================================================================ 8. plus de carte « Paternité de l'IA », numéros intacts
await p.evaluate(() => render('detail', 'b1'));
check(await p.evaluate(() => !document.getElementById('carte-paternite-ia') && !document.getElementById('btn-edit-paternite-ia')), 'fiche brebis : plus de carte « Paternité de l\'IA »');
check(await p.evaluate(() => JSON.stringify(DB.brebis.map(b => b.eid)) === window.__eids), 'aucun numéro modifié');
console.log('OK PC : import, garde-fous, remplacement, père qui suit, généalogie, tri, lot IA.');
await p.context().close();

// ================================================================ 9. mobile : ISOL du père dans la carte de tri, pas d'import ni de carte Paternité
const m = await ouvrir(false);
await m.evaluate(() => { const ia = { pereCourt: '40731', pereNumero: '00001240731', indexIsol: 98, source: 'import' }; DB.brebis[0].modesRepro[0].ia = ia; DB.brebis[0].agnelages[0].lambs.forEach(l => appliquerPereIa(l, ia)); triMobileScan = null; triMobileToast = null; triMobileOnglet = 'aTrier'; render('agnelles'); });
await m.click('#tri-carte-250000004561001 .carte-liste-l1');
check(/Classe 2 · Lactation \S+ 312,0 L · ISOL père 98/.test(await m.evaluate(() => document.getElementById('tri-genealogie').textContent)), 'mobile : ISOL du père après la classe et la lactation de la mère');
await m.evaluate(() => render('detail', 'b1'));
check(await m.evaluate(() => !document.getElementById('carte-paternite-ia')), 'mobile : plus de carte « Paternité de l\'IA »');
console.log('OK mobile : ISOL du père au tri, plus de carte Paternité.');
await m.context().close();
await browser.close();
console.log('\nTOUS LES TESTS « PATERNITÉ DES IA » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
