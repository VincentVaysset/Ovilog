/* Mode d'emploi des imports : UNE feuille A4 PDF par modèle (au lieu d'un onglet « Instructions » dans le fichier Excel).
   - Paramètres › Imports (PC) : bouton « Mode d'emploi » à côté de « Télécharger le modèle » sur chaque carte (pas pour les fichiers SIEOL) ;
   - PDF d'une page, portrait A4, charte (bandeau vert), nom de fichier « Mode_emploi_… .pdf » ;
   - contrôle laitier : tableau des codes 01 à 11 ; les codes 01 à 05 prennent les noms réglés dans Paramètres › Règles d'élevage › Lait ;
   - lactation : la version du type de suivi (CLS : classe par quart ; CLO : index ISOL, index production) ;
   - les modèles Excel n'ont plus d'onglet « Instructions » (ni celui des inséminations, fabriqué par l'appli).
   Jeu SYNTHÉTIQUE, aucune donnée réelle. */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
const p = await ctx.newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple', typeSuivi: 'cls' });
  DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.__f = [];
  saveOrShareBinaryFile = async (n, b) => { if (exportCapture) { exportCapture.terminer(); return; } window.__f.push({ n, b: Array.from(b) }); if (triExportFin) { const f = triExportFin; triExportFin = null; setTimeout(f, 0); } };
  parametresTab = 'imports'; render('parametres');
});
await p.waitForTimeout(600);
const texte = mots => mots.join(' ');

// 1. un bouton par carte, à côté de « Télécharger le modèle »
eq(await p.$$eval('.btn-mode-emploi', bs => bs.map(b => b.dataset.cle + ':' + b.textContent)), ['correspondance-sieol:Mode d\'emploi', 'controle-laitier:Mode d\'emploi', 'lactation:Mode d\'emploi', 'nouveaux-animaux:Mode d\'emploi', 'inseminations:Mode d\'emploi'], 'boutons « Mode d\'emploi »');
check(await p.$$eval('.btn-mode-emploi', bs => bs.every(b => b.previousElementSibling && b.previousElementSibling.classList.contains('btn-modele-import'))), 'à côté de « Télécharger le modèle »');

// 2. chaque PDF : une page A4 portrait, charte, bon contenu
const attendus = {
  'correspondance-sieol': ['Mode_emploi_Correspondance_SIEOL.pdf', ['EID', 'N° d\'ordre', 'jamais remplacé']],
  'controle-laitier': ['Mode_emploi_Controle_Laitier.pdf', ['Codes de votre technicien', 'Vide définitive', 'jamais (0/09)', 'Allaitante et traite', 'Garder Ovilog']],
  'lactation': ['Mode_emploi_Lactation_CLS.pdf', ['Classe par quart', 'Lactation totale']],
  'nouveaux-animaux': ['Mode_emploi_Nouveaux_Animaux.pdf', ['Origine', 'Père / Mère']],
  'inseminations': ['Mode_emploi_Inseminations.pdf', ['Onglet « Béliers »', 'Code IA', 'Remplacer']]
};
for (const [cle, [nom, phrases]] of Object.entries(attendus)) {
  await p.evaluate(() => { window.__f = []; });
  await p.click(`.btn-mode-emploi[data-cle="${cle}"]`);
  await p.waitForFunction(() => window.__f.length === 1, null, { timeout: 5000 });
  const f = await p.evaluate(() => window.__f[0]);
  eq(f.n, nom, cle + ' : nom du fichier');
  const pdf = lirePdfMots(f.b);
  eq(pdf.pages, 1, cle + ' : une seule page');
  check(Math.round(pdf.tailles[0][0]) === 595 && Math.round(pdf.tailles[0][1]) === 842, cle + ' : A4 portrait');
  check(pdf.vert > 50, cle + ' : charte (bandeau vert)');
  const t = texte(pdf.mots);
  check(t.includes('Mode d\'emploi'), cle + ' : titre');
  phrases.forEach(ph => check(t.includes(ph), cle + ' : « ' + ph + ' » dans le PDF'));
}

// 3. lactation CLO : index ISOL et index production
await p.evaluate(() => { DB.exploitation.typeSuivi = 'clo'; window.__f = []; });
const clo = texte(lirePdfMots(await p.evaluate(() => Array.from(buildModeEmploiPdfBytes('lactation-clo')))).mots);
check(clo.includes('Index ISOL') && clo.includes('Index production') && !clo.includes('Classe par quart'), 'lactation CLO : ses colonnes');

// 4. codes 01 à 05 : noms réglés par l'éleveur
await p.evaluate(() => { DB.libellesAnomaliesControle = { 1: 'Problème de pis', 2: 'Lait anormal', 3: '', 4: 'Boucle conventionnelle manquante', 5: 'Réforme' }; });
const cl = texte(lirePdfMots(await p.evaluate(() => Array.from(buildModeEmploiPdfBytes('controle-laitier')))).mots);
check(cl.includes('Lait anormal') && cl.includes('Code de votre technicien') && !cl.includes('01 à 05 Codes de votre technicien'), 'codes 01 à 05 nommés un par un : ' + cl.slice(0, 400));

// 5. modèle des inséminations : plus d'onglet « Mode d'emploi »
await p.evaluate(() => { window.__f = []; });
await p.click('.btn-modele-import[data-cle="inseminations"]');
await p.waitForFunction(() => window.__f.length === 1, null, { timeout: 5000 });
const octetsIa = await p.evaluate(() => window.__f[0].b);
const onglets = JSON.parse(execFileSync('python3', ['-I', '-c', "import zipfile, re, sys, io, json; z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(json.dumps(re.findall(r'<sheet name=\"([^\"]+)\"', z.read('xl/workbook.xml').decode())))"], { input: Buffer.from(octetsIa), encoding: 'utf8' }));
eq(onglets, ['Béliers', 'Brebis inséminées'], 'modèle des inséminations : ses deux onglets seulement');

await browser.close();
console.log('OK test_mode_emploi_imports');
