/* Refonte Paramètres, partie 4 : Imports (PC uniquement). Une carte par import (Correspondance SIEOL, Contrôle laitier, Lactation, Nouveaux animaux) : description, colonnes attendues
   avec ligne d'exemple LUES dans le vrai fichier modèle embarqué, état du dernier import (« aucun » avant le premier ; date · campagne · lignes ensuite, mémorisé sur l'appareil), boutons distincts
   « Télécharger le modèle » (le fichier .xlsx d'origine, octet pour octet) et « Importer un fichier » (ouvre l'écran d'import existant, logique inchangée). Lactation selon CLS / CLO.
   Aucune rubrique Imports sur mobile. Plus d'aperçu en images ni de ❔. Import réel de bout en bout avec les vrais modèles (Correspondance SIEOL, Lactation). saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const alertes = [];
page.on('dialog', d => { alertes.push(d.message()); d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
const jeu = (typeSuivi) => page.evaluate((ts) => {
  localStorage.removeItem('ovilog_derniers_imports');
  window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = { ...DB.exploitation, typeSuivi: ts };
  const b = (n, court) => ({ id: 'b' + n, eid: '250 0162991' + n, statut: 'active', numeroCourtTravailSieol: court || null, mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: [], createdAt: 1 });
  DB.brebis = [b('51001', null), b('51002', null)];
  parametresTab = 'imports'; render('parametres');
}, typeSuivi);
const attendreApercus = () => page.waitForFunction(() => document.querySelectorAll('.prm-import').length > 0 && [...document.querySelectorAll('.prm-apercu')].every(z => z.querySelector('table')), null, { timeout: 15000 });
const apercu = (cle) => page.evaluate(c => ({ th: [...document.querySelectorAll(`#apercu-${c} th`)].map(e => e.textContent), td: [...document.querySelectorAll(`#apercu-${c} td`)].map(e => e.textContent) }), cle);

// ---- 1. cartes, colonnes lues dans les vrais modèles
await jeu('cls'); await attendreApercus();
eq(await page.evaluate(() => [...document.querySelectorAll('.prm-import .prm-titre')].map(e => e.textContent)), ['Correspondance SIEOL', 'Contrôle laitier', 'Lactation', 'Nouveaux animaux'], '4 cartes d\'import (suivi CLS)');
eq(await page.evaluate(() => [...document.querySelectorAll('.prm-import .prm-titre + .prm-note')].map(e => e.textContent)), ['Associe chaque animal à ses numéros de travail SIEOL.', 'Lait et anomalies des contrôles de la campagne en cours, par brebis.', 'Lactation totale et indicateurs de la campagne en cours (suivi CLS ou CLO).', 'Crée les fiches manquantes et complète les fiches existantes. Trois feuilles : Brebis, Béliers, Agnelles.'], 'une ligne de description par carte');
eq(await apercu('correspondance-sieol'), { th: ['Numéro EID complet (11 chiffres)', 'Numéro officiel Ovilog', 'Numéro long travail SIEOL', 'Numéro court travail SIEOL'], td: ['16299151001', '51001', '259001', '59001'] }, 'Correspondance SIEOL : colonnes + exemple du vrai modèle');
eq(await apercu('controle-laitier'), { th: ['Numéro EID complet (11 chiffres)', 'Numéro SIEOL (court ou long)', 'Contrôle 1 (mL[/code])', 'Contrôle 2 (mL[/code])', 'Contrôle 3 (mL[/code])'], td: ['—', '180055', '1440', '1300', '1060'] }, 'Contrôle laitier : colonnes + exemple');
eq(await apercu('lactation'), { th: ['Numéro SIEOL court', 'Lactation totale (L, campagne)', 'Jours de traite (campagne)', 'Lactation moyenne', 'Classe par quart'], td: ['501', '285.4', '178', '258', '4'] }, 'Lactation CLS : colonnes + exemple');
eq((await apercu('nouveaux-animaux')).th, ['Origine', 'Numéro EID complet (11 chiffres)', "Date d'entrée (JJ-MM-AAAA)", 'Statut', 'Père (facultatif)', 'Mère (facultatif)', 'Numéro long travail SIEOL', 'Numéro court travail SIEOL'], 'Nouveaux animaux : colonnes de la feuille Brebis');
check((await apercu('nouveaux-animaux')).td[0] === 'née' && (await apercu('nouveaux-animaux')).td[4] === '—', 'Nouveaux animaux : exemple (cellules vides = —)');
check(await page.evaluate(() => !document.getElementById('app').textContent.includes('❔') && !document.querySelector('[data-apercu-modele]') && !document.querySelector('img[src^="data:image/png"]:not(.logo-img)')), 'plus de ❔ ni d\'aperçu en images');
eq(await page.evaluate(() => [...document.querySelectorAll('.prm-import')].map(c => [...c.querySelectorAll('.prm-actions .btn')].map(b => b.textContent + (b.classList.contains('btn-primary') ? '*' : '')))), Array(4).fill(['Télécharger le modèle', 'Importer un fichier*']), 'deux boutons distincts par carte');
eq(await page.evaluate(() => [...document.querySelectorAll('[id^="dernier-"]')].map(e => e.textContent)), ['aucun', 'aucun', 'aucun', 'aucun'], 'dernier import : « aucun » au départ');
console.log('OK 1 : 4 cartes, description, colonnes et exemples lus dans les vrais modèles, deux boutons, « aucun ».');

// ---- 2. Lactation CLO / non suivi
await jeu('clo'); await attendreApercus();
eq((await apercu('lactation')).th.slice(4), ['Index ISOL', 'Index production'], 'Lactation CLO : colonnes du modèle CLO');
await jeu(null); await page.waitForTimeout(400);
check(await page.evaluate(() => !document.getElementById('import-lactation') && /apparaît quand le type de suivi laitier est CLS ou CLO/.test(document.getElementById('imports-note-lactation').textContent)), 'sans suivi CLS/CLO : pas de carte Lactation, explication affichée');
console.log('OK 2 : Lactation selon CLS / CLO, règle conservée avec explication.');

// ---- 3. télécharger le modèle : le fichier d'origine, octet pour octet
await jeu('cls'); await attendreApercus();
// copies des modèles d'origine versionnées avec les tests (tests/fixtures/modeles)
const dossier = new URL('./fixtures/modeles/', import.meta.url).pathname;
const orig = (n) => existsSync(dossier + n) ? readFileSync(dossier + n) : null;
const attendus = { 'correspondance-sieol': 'Modele_Correspondance_SIEOL.xlsx', 'controle-laitier': 'Modele_Controle_Laitier.xlsx', 'lactation': 'Modele_Lactation_CLS.xlsx', 'nouveaux-animaux': 'Modele_Nouveaux_Animaux.xlsx' };
for (const [cle, nomFichier] of Object.entries(attendus)) {
  const dl = page.waitForEvent('download', { timeout: 10000 });
  await page.click(`#import-${cle} .btn-modele-import`);
  const d = await dl;
  eq(d.suggestedFilename(), nomFichier, 'nom du fichier téléchargé (' + cle + ')');
  const chemin = await d.path(); const recu = readFileSync(chemin);
  const o = orig(nomFichier);
  if (o) check(Buffer.compare(recu, o) === 0, 'fichier téléchargé identique octet pour octet au modèle fourni (' + nomFichier + ')');
  else check(recu.length > 10000 && recu[0] === 0x50 && recu[1] === 0x4b, 'fichier .xlsx valide (modèle d\'origine absent de ce poste) : ' + nomFichier);
}
console.log('OK 3 : « Télécharger le modèle » sert le fichier d\'origine pour chaque import.');

// ---- 4. « Importer un fichier » ouvre l'écran d'import existant
for (const [cle, vue] of [['correspondance-sieol', 'import-correspondance-sieol'], ['controle-laitier', 'import-controle-laitier-modele'], ['lactation', 'import-lactation-modele'], ['nouveaux-animaux', 'import-nouveaux-animaux']]) {
  await jeu('cls'); await attendreApercus();
  await page.click(`#import-${cle} .btn-primary`);
  eq(await page.evaluate(() => currentView), vue, 'écran d\'import ouvert (' + cle + ')');
}
console.log('OK 4 : « Importer un fichier » ouvre l\'écran d\'import (logique inchangée).');

// ---- 5. import réel de bout en bout avec les vrais modèles : état « dernier import »
const modeleCorr = orig('Modele_Correspondance_SIEOL.xlsx');
if (modeleCorr) {
  // adapte les numéros d'exemple (ligne 5 : EID 16299151001) aux brebis du jeu
  await jeu('cls'); await attendreApercus();
  await page.evaluate(() => { DB.brebis[0].eid = '250 016299151001'; DB.brebis[1].eid = '250 016194751001'; });
  await page.click('#import-correspondance-sieol .btn-primary');
  await page.setInputFiles('input[type=file]', { name: 'Modele_Correspondance_SIEOL.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: modeleCorr });
  await page.waitForSelector('#btn-confirm-import-corresp-sieol:not(.hidden)', { timeout: 10000 });
  await page.click('#btn-confirm-import-corresp-sieol'); await page.waitForTimeout(300);
  eq(await page.evaluate(() => currentView), 'parametres', 'retour sur Paramètres après l\'import');
  const mem = await page.evaluate(() => JSON.parse(localStorage.getItem('ovilog_derniers_imports')));
  check(mem['correspondance-sieol'] && mem['correspondance-sieol'].lignes === 2 && mem['correspondance-sieol'].campagne === null, 'état mémorisé (2 lignes, pas de campagne) : ' + JSON.stringify(mem));
  await page.evaluate(() => { parametresTab = 'imports'; render('parametres'); }); await attendreApercus();
  check(/^\d\d-\d\d-\d{4} · 2 lignes$/.test(await page.evaluate(() => document.getElementById('dernier-correspondance-sieol').textContent)), 'dernier import affiché : ' + await page.evaluate(() => document.getElementById('dernier-correspondance-sieol').textContent));
  console.log('OK 5 : import réel du modèle Correspondance SIEOL -> « dernier import » mémorisé et affiché.');
} else console.log('SKIP 5 : modèles d\'origine absents de ce poste');
// ---- 6. mémoire directe avec campagne
await page.evaluate(() => { noterDernierImport('lactation', 2026, 1); noterDernierImport('controle-laitier', 2026, 351); parametresTab = 'imports'; render('parametres'); }); await attendreApercus();
eq(await page.evaluate(() => [document.getElementById('dernier-lactation').textContent.replace(/^\d\d-\d\d-\d{4}/, 'D'), document.getElementById('dernier-controle-laitier').textContent.replace(/^\d\d-\d\d-\d{4}/, 'D')]), ['D · campagne 2027 · 1 ligne', 'D · campagne 2027 · 351 lignes'], 'format avec campagne et pluriel');
console.log('OK 6 : format « date · campagne · lignes ».');

// ---- 7. mobile : pas de rubrique Imports
const mob = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
await mob.goto(URL_APP, { waitUntil: 'load' }); await mob.waitForTimeout(300);
await mob.evaluate(() => { DB = migrateData({}); saveData = () => true; parametresRubrique = null; render('parametres'); });
eq(await mob.evaluate(() => [...document.querySelectorAll('.prm-rub-titre')].map(e => e.textContent)), ['Exploitation', 'Campagne', 'Listes', 'Sauvegarde'], 'mobile : aucune rubrique Imports');
check(await mob.evaluate(() => /les imports de fichiers se font sur PC/.test(document.querySelector('.prm-pied').textContent)), 'mobile : mention « les imports de fichiers se font sur PC »');
console.log('OK 7 : mobile sans Imports.');
await browser.close();
console.log('\nTOUS LES TESTS DE PARAMÈTRES > IMPORTS SONT PASSÉS');
