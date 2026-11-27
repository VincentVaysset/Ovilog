/* Import du « Bilan brebis » de SIEOL en PDF (PC) : PDF SYNTHÉTIQUE fabriqué ici (n° fictifs, aucune donnée réelle), lu par le vrai lecteur pdf.js
   local de l'appli. (1) contrôle BLOQUANT : brebis lues ≠ « Nombre de brebis éditées » = rien d'importé ; (2) PDF conforme : colonnes lues par
   position, campagne = « Campagne précédente », zéros de tête significatifs (« 0117 » ≠ « 117 »), aperçu à part : brebis du PDF absentes
   d'Ovilog, brebis d'Ovilog absentes du PDF, classes hors 1 à 4, différences avec la base (remplacées seulement si la case est cochée) ;
   (3) écriture dans le Bilan de lactation SIEOL, lue par la fiche ; (4) lecteur PDF absent = message clair ; mobile : pas d'import PDF ; (5) VRAI PDF lu sur place si OVILOG_BILAN_BREBIS_PDF et
   OVILOG_BILAN_BREBIS_ATTENDU donnent ses chemins (jamais copié dans le dépôt), sinon sauté. */
import { chromium } from 'playwright';
import fs from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

// ---- fabrication d'un PDF texte minimal (Helvetica, positions en points comme le Bilan brebis SIEOL)
function pdfTexte(pages) {
  const echap = t => String(t).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, c => '\\' + c.charCodeAt(0).toString(8).padStart(3, '0'));
  const objets = [];
  const ajouter = s => { objets.push(s); return objets.length; };
  const police = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pagesId = objets.length + 1 + pages.length * 2 + 1;
  const kids = [];
  pages.forEach(items => {
    const flux = 'BT /F1 8 Tf ' + items.map(([x, y, t]) => '1 0 0 1 ' + x + ' ' + y + ' Tm (' + echap(t) + ') Tj').join(' ') + ' ET';
    const contenu = ajouter('<< /Length ' + Buffer.byteLength(flux, 'latin1') + ' >>\nstream\n' + flux + '\nendstream');
    kids.push(ajouter('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' + police + ' 0 R >> >> /Contents ' + contenu + ' 0 R >>'));
  });
  ajouter('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
  const catalogue = objets.length;
  check(ajouter('<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>') === pagesId, 'numérotation des objets du PDF');
  let out = '%PDF-1.4\n'; const offsets = [];
  objets.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objets.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objets.length + 1) + ' /Root ' + catalogue + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(out, 'latin1');
}
const ENTETE = [[273, 740, 'Bilan brebis'], [53, 720, 'UNOTEC'], [240, 720, 'Campagne précédente : 2026'], [478, 720, 'Campagne'], [533, 720, '2027'],
  [49, 667, 'Numéro'], [87, 667, 'Num'], [185, 667, 'Date'], [337, 667, 'Lact'], [455, 667, 'Class'], [52, 656, 'animal'], [175, 656, 'mise'], [336, 656, 'totale'], [449, 656, 'par quart']];
// une brebis : [n°, date de mise bas | null, lactation totale, durée, classe, décalage vertical du n°]
const ligne = (y, [num, date, lact, duree, classe, dy]) => [[56, y + (dy || 0), num], [96, y, '1']].concat(date ? [[171, y, date], [239, y, '1'], [273, y, '7'], [340, y, lact], [379, y, duree], [420, y, '1900'], [482, y, classe]] : [[146, y, '10'], [273, y, '7'], [308, y, '1'], [437, y, '0'], [482, y, classe]]);
const BREBIS = [['581', '08/12/2025', '306,8', '144', '2', 1], ['583', '03/02/2026', '146,2', '87', '3'], ['0117', '06/11/2025', '410,0', '176', '1', 1], ['117', '07/11/2025', '250,5', '170', '4'],
  ['582', null, '', '', '0'], ['9999', '10/11/2025', '300,0', '160', '2'], ['808', '06/11/2025', '268,2', '176', '4', -1], ['900', '12/11/2025', '280,0', '165', '5']];
// coupe : dernière ligne de la page 1 au ras du bas (y = 4), comme un PDF imprimé dont la ligne suivante est perdue
const fabriquer = (annonce, coupe) => {
  const p1 = ENTETE.concat(...BREBIS.slice(0, 5).map((b, i) => ligne((coupe ? 64 : 640) - 15 * i, b)));
  const p2 = ENTETE.concat(...BREBIS.slice(5).map((b, i) => ligne(640 - 15 * i, b)), [[80, 560, 'Nombre de brebis éditées'], [194, 560, ':'], [200, 560, String(annonce)]]);
  return pdfTexte([p1, p2]);
};

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-11-27T09:00:00'));
const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { typeSuivi: 'cls' });
  const f = (n, court, extra) => Object.assign({ id: 'b' + n, eid: '2500000129' + String(70000 + n), numeroCourtTravailSieol: court, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, extra || {});
  DB.brebis = [f(1, '581'), f(2, '583'), f(3, '0117'), f(4, '117'), f(5, '582'), f(6, '808'), f(7, '900'), f(8, '700')];
  DB.bilanLactation = [{ eid: DB.brebis[1].eid, campagne: 2025, dateMiseBas: '2026-02-03', lactTotale: 140, dureeTraite: 80, classeParQuart: 4 }];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
});
const ouvrirImport = async () => { await page.evaluate(() => render('import-bilan-brebis-pdf')); await page.waitForSelector('#import-bb-file'); };
const deposer = async buf => { await page.setInputFiles('#import-bb-file', { name: 'Bilan_brebis_test.pdf', mimeType: 'application/pdf', buffer: buf }); await page.waitForSelector('#import-bb-resume, #import-bb-erreur, #import-bb-err:not(.hidden)', { timeout: 20000 }); };

// ===== 0. carte dans Paramètres › Imports (suivi CLS)
await jeu();
await page.evaluate(() => { parametresTab = 'imports'; render('parametres'); });
check(await page.evaluate(() => !!document.getElementById('import-bilan-brebis-pdf') && /Importer le PDF SIEOL/.test(document.getElementById('btn-import-bilan-brebis-pdf').textContent)), 'carte « Bilan de lactation · PDF SIEOL » avec « Importer le PDF SIEOL »');
await page.evaluate(() => { DB.exploitation.typeSuivi = 'clo'; render('parametres'); });
check(await page.evaluate(() => !document.getElementById('import-bilan-brebis-pdf')), 'suivi CLO : pas de carte (aucune classe)');
console.log('OK 0 carte d\'import sur PC en suivi CLS, absente en CLO.');

// ===== 1. contrôle bloquant : 8 brebis lues, 9 annoncées
await jeu(); await ouvrirImport();
await deposer(fabriquer(9, true));
const b1 = await page.evaluate(() => ({ bloque: (document.getElementById('import-bb-bloque') || {}).textContent || '', bouton: !!document.getElementById('btn-confirm-import-bb'), bilan: DB.bilanLactation.length }));
check(/Import impossible/.test(b1.bloque) && /8 brebis lues sur 9 annoncées/.test(b1.bloque) && /il en manque 1/.test(b1.bloque), 'nombre différent : bloquant : ' + b1.bloque);
check(/1 saut\(s\) de page où une ligne est coupée : pages 1 et 2/.test(b1.bloque), 'saut de page concerné nommé : ' + b1.bloque);
check(/Document incomplet : demandez un export direct \(Excel, CSV ou PDF exporté, pas imprimé\)\./.test(b1.bloque), 'message « demandez un export direct » : ' + b1.bloque);
eq([b1.bouton, b1.bilan], [false, 1], 'bloqué : aucun bouton Importer, rien d\'écrit');
console.log('OK 1 contrôle bloquant : 8 lues sur 9 annoncées, saut de page nommé, « demandez un export direct », rien d\'importé.');

// ===== 2. PDF conforme : lecture par position, zéros de tête, aperçu à part
await jeu(); await ouvrirImport();
await deposer(fabriquer(8));
const ap = await page.evaluate(() => {
  const t = id => (document.getElementById(id) || {}).textContent || '';
  return { resume: t('import-bb-resume'), bloque: !!document.getElementById('import-bb-bloque'), absOvilog: t('import-bb-absents-ovilog'), absPdf: t('import-bb-absents-pdf'), horsClasse: t('import-bb-hors-classe'), diff: t('import-bb-differences'), aEcrire: t('import-bb-a-ecrire') };
});
check(/8 brebis lues sur 8 annoncées/.test(ap.resume) && !ap.bloque, 'conforme : 8 sur 8 : ' + ap.resume);
check(/\(1\)/.test(ap.absOvilog) && /9999/.test(ap.absOvilog), 'brebis du PDF absente d\'Ovilog : 9999 : ' + ap.absOvilog);
check(/\(1\)/.test(ap.absPdf) && /700/.test(ap.absPdf), 'brebis d\'Ovilog absente du PDF : 700 : ' + ap.absPdf);
check(/\(2\)/.test(ap.horsClasse) && /582 : 0/.test(ap.horsClasse) && /900 : 5/.test(ap.horsClasse), 'classes hors 1 à 4 : 582 (0), 900 (5) : ' + ap.horsClasse);
check(/\(1\)/.test(ap.diff) && /583 : classe 4 → 3/.test(ap.diff), 'différence avec la base : 583 classe 4 → 3 : ' + ap.diff);
check(/6 brebis à enregistrer/.test(ap.aEcrire), 'à enregistrer : 6 (la différence attend la case) : ' + ap.aEcrire);
await page.click('#btn-confirm-import-bb');
await page.waitForSelector('#import-bb-ok');
const r2 = await page.evaluate(() => {
  const c = (n) => lactationBrebisCampagne(DB.brebis.find(b => b.numeroCourtTravailSieol === n).eid, 2025);
  return { v: ['581', '583', '0117', '117', '582', '808', '900'].map(n => { const x = c(n); return n + ':' + x.classe + ':' + x.lactation; }), sansMb: DB.sieolSansMiseBas.length, ok: document.getElementById('import-bb-ok').textContent,
    dernier: texteDernierImport('bilan-brebis-pdf') };
});
eq(r2.v, ['581:2:306.8', '583:4:140', '0117:1:410', '117:4:250.5', '582:null:null', '808:4:268.2', '900:null:280'], 'écrit dans le Bilan SIEOL (zéros de tête : 0117 et 117 distinctes ; 583 non remplacée ; classe 5 et 0 « - »)');
check(r2.sansMb === 1 && /campagne/.test(r2.ok), 'brebis sans mise bas notée à part ; message : ' + r2.ok);
// la différence : remplacée seulement case cochée
await deposer(fabriquer(8));
await page.click('#import-bb-remplacer');
await page.click('#btn-confirm-import-bb');
await page.waitForSelector('#import-bb-ok');
eq(await page.evaluate(() => { const x = lactationBrebisCampagne(DB.brebis[1].eid, 2025); return [x.classe, x.lactation]; }), [3, 146.2], 'case cochée : 583 prend les valeurs du PDF');
console.log('OK 2 lecture par position, zéros de tête significatifs, aperçu (absentes des deux côtés, hors classe, différences), écriture, remplacement sur case cochée.');

// ===== 3. la fiche lit le Bilan importé
await page.evaluate(() => render('detail', 'b1'));
await page.click('.fiche-tab-btn[data-tab="carriere"]'); await page.waitForTimeout(150);
check(await page.evaluate(() => /Classe 2/.test(document.getElementById('app').innerHTML)), 'fiche (Carrière) : « Classe 2 » de la campagne importée');
console.log('OK 3 la fiche lit la classe importée.');

// ===== 4. lecteur PDF absent : message clair ; mobile : pas d'import PDF
const ctx2 = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx2.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
const p2 = await ctx2.newPage();
await p2.route('**/vendor/pdfjs/**', r => r.fulfill({ status: 404, body: '' }));
await p2.goto(URL_APP, { waitUntil: 'load' }); await p2.waitForTimeout(300);
await p2.evaluate(() => { DB = migrateData({}); DB.campagneDebut = 2026; DB.campagneInitialisee = true; render('import-bilan-brebis-pdf'); });
await p2.setInputFiles('#import-bb-file', { name: 'b.pdf', mimeType: 'application/pdf', buffer: fabriquer(8) });
await p2.waitForSelector('#import-bb-err:not(.hidden)', { timeout: 15000 });
check(/Lecteur de PDF absent de cette installation/.test(await p2.textContent('#import-bb-err')), 'lecteur absent : message clair');
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p3 = await ctx3.newPage();
await p3.goto(URL_APP, { waitUntil: 'load' }); await p3.waitForTimeout(300);
check(/sur PC/.test(await p3.evaluate(() => chargerLecteurPdf().then(() => 'chargé', e => e.message))), 'mobile : le lecteur PDF n\'est jamais chargé');
check(!erreurs.length, 'erreurs JS : ' + erreurs.slice(0, 3).join(' | '));
console.log('OK 4 lecteur PDF absent : message clair, rien d\'importé ; mobile : aucun chargement.');
// ===== 5. VRAI Bilan brebis (PDF imprimé depuis SIEOL), LU SUR PLACE, jamais copié dans le dépôt (données réelles) :
// OVILOG_BILAN_BREBIS_PDF = chemin du PDF, OVILOG_BILAN_BREBIS_ATTENDU = chemin d'un JSON des valeurs attendues (hors dépôt).
// Absents (GitHub) : section sautée. Lecture : chaque ligne présente lue, colonnes comprises ; refus : document incomplet.
const cheminReel = process.env.OVILOG_BILAN_BREBIS_PDF, cheminAttendu = process.env.OVILOG_BILAN_BREBIS_ATTENDU;
if (cheminReel && cheminAttendu && fs.existsSync(cheminReel) && fs.existsSync(cheminAttendu)) {
  const att = JSON.parse(fs.readFileSync(cheminAttendu, 'utf8'));
  const bytes = fs.readFileSync(cheminReel);
  await page.evaluate(() => { DB = migrateData({}); DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { typeSuivi: 'cls' }); });
  const lu = await page.evaluate(async b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const l = await lirePdfBilanBrebis(u.buffer);
    const par = {}; l.lignes.forEach(x => { par[x.numero] = x; });
    const rep = {}; l.lignes.forEach(x => { const k = String(x.classe); rep[k] = (rep[k] || 0) + 1; });
    return { n: l.lignes.length, annonce: l.annonce, cp: l.campagnePrecedente, numerosOk: l.lignes.every(x => /^\d+$/.test(x.numero)), uniques: Object.keys(par).length, rep, par,
      bloque: classerBilanBrebisPdf(l).bloque };
  }, bytes.toString('base64'));
  eq(lu.n, att.luesReelles, 'PDF réel : lignes lues');
  check(lu.numerosOk && lu.uniques === lu.n, 'PDF réel : chaque ligne a un n° seul, sans doublon (aucune ligne fusionnée) : ' + lu.uniques);
  eq(lu.annonce, att.annonce, 'PDF réel : « Nombre de brebis éditées »'); eq(lu.cp, att.campagnePrecedente, 'PDF réel : campagne précédente');
  Object.entries(att.classes).forEach(([n, c]) => eq(lu.par[n] && lu.par[n].classe, c, 'PDF réel : classe de ' + n));
  Object.entries(att.lignes).forEach(([n, v]) => Object.entries(v).forEach(([k, val]) => eq(lu.par[n] && (lu.par[n][k] === undefined || lu.par[n][k] === '' ? null : lu.par[n][k]), val, 'PDF réel : ' + n + ' ' + k)));
  eq(lu.rep, att.repartitionClasses, 'PDF réel : répartition des classes (toutes les colonnes de classe lues)');
  const txt = lu.bloque.join(' ');
  check(txt.includes(att.luesReelles + ' brebis lues sur ' + att.annonce + ' annoncées'), 'PDF réel : refus « ' + att.luesReelles + ' brebis lues sur ' + att.annonce + ' annoncées » : ' + txt);
  check(txt.includes(att.sauts.length + ' saut(s) de page où une ligne est coupée : ' + att.sauts.join(', ') + '.'), 'PDF réel : les ' + att.sauts.length + ' sauts de page nommés : ' + txt);
  check(txt.includes('Document incomplet : demandez un export direct'), 'PDF réel : « demandez un export direct »');
  // à l'écran : refus, rien d'importé
  await ouvrirImport(); const avant = await page.evaluate(() => (DB.bilanLactation || []).length);
  await page.setInputFiles('#import-bb-file', { name: 'Bilan_brebis.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.waitForSelector('#import-bb-bloque', { timeout: 30000 });
  check(await page.evaluate(() => !document.getElementById('btn-confirm-import-bb') || document.getElementById('btn-confirm-import-bb').disabled), 'PDF réel : import impossible à l\'écran');
  eq(await page.evaluate(() => (DB.bilanLactation || []).length), avant, 'PDF réel : rien d\'écrit');
  console.log('OK 5 PDF réel lu sur place : ' + lu.n + ' lignes, colonnes et classes de contrôle exactes, refusé (' + att.sauts.length + ' sauts de page, export direct demandé).');
} else console.log('-- 5 PDF réel absent (OVILOG_BILAN_BREBIS_PDF / OVILOG_BILAN_BREBIS_ATTENDU) : section sautée.');
await browser.close();
console.log('TOUS LES TESTS « IMPORT BILAN BREBIS PDF » SONT PASSÉS (PDF synthétique, n° fictifs)');
