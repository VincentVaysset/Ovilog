/* Retouches Production laitière / Bilan économique (aucun changement de mise en page) : (1) rouge réservé aux vraies alertes : « Non obtenu » (Super A) en gris sur PC (Qualité, Bilan économique), « Pénalités 0 € »
   neutre (rouge seulement s'il y a des pénalités), le bandeau de résultat positif et les boutons « Supprimer » restent rouges ; (2) un seul titre : plus de titre répété dans Qualité du lait et Bilan économique
   (PC), le Tank le garde ; (3) exports : « Export Excel » (blanc) puis « Export PDF » (vert) en Qualité du lait (PC et mobile), « Export PDF » en Bilan économique, plus aucun « Rapport de campagne (PDF) » ;
   Excel de la qualité valide (zip, feuille, lignes de la campagne affichée seulement) ; (4) textes : renvoi vers le Bilan économique, icône SVG à la place de l'emoji, échec d'export = message de charte, jamais d'alert().
   Jeu synthétique, saveData remplacé, saveOrShareBinaryFile remplacé. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const ROUGE = 'rgb(163, 58, 49)', ROUGE_PASTEL = 'rgb(251, 227, 224)', VERT = 'rgb(53, 127, 75)', BLANC = 'rgb(255, 255, 255)';
const browser = await chromium.launch(LAUNCH);
const jeu = () => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const tank = [{ date: '2026-02-05', quantite: 300 }];
  [[2026, 10], [2026, 11], [2026, 12], [2027, 1], [2027, 2], [2027, 3]].forEach(([y, m], i) => { for (const j of [3, 8, 14]) tank.push({ date: y + '-' + String(m).padStart(2, '0') + '-' + String(j).padStart(2, '0'), quantite: 380 + i * 25 + j }); });
  DB.laitTank = tank;
  const pr = (date, extra) => Object.assign({ id: 'p' + date, date, volumeLait: DB.laitTank.find(t => t.date === date).quantite, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: null, salmonelles: null, campagne: campagneAnneeDebutPourDate(date) }, extra);
  DB.prelevementsQualite = [
    pr('2026-02-05', { tb: 60, tp: 50, cellules: 500000, floreTotale: 30000, coliformes: 10, butyriques: 20, listeria: 'negatif', salmonelles: 'negatif' }),      // campagne précédente : jamais dans l'export de 2026
    pr('2026-10-08', { tb: 68.2, tp: 54.1, cellules: 410000, floreTotale: 18000, coliformes: 40, butyriques: 90, listeria: 'negatif', salmonelles: 'negatif' }),
    pr('2027-01-08', { tb: 72, tp: 56, cellules: 350000, floreTotale: 15000, coliformes: 30, butyriques: 60, listeria: 'negatif', salmonelles: 'positif' }),
    pr('2027-03-03', {})];                                                                                                                                         // « résultats à saisir »
  DB.penalitesBacterio = []; DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12.1538, prixReference: 0.9, msuReference: 120 }];
  window.__saisies = []; window.__alertes = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, octets: Array.from(bytes) }); };
};
const lireXlsx = (octets) => {
  const f = path.join(mkdtempSync(path.join(tmpdir(), 'ovilog-xlsx-')), 'q.xlsx'); writeFileSync(f, Buffer.from(octets));
  const PY = `import sys, json, zipfile, re
import xml.etree.ElementTree as ET
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
noms = z.namelist()
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
wb = ET.fromstring(z.read('xl/workbook.xml'))
feuilles = [s.get('name') for s in wb.find('m:sheets', ns)]
ss = []
if 'xl/sharedStrings.xml' in noms:
    for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns): ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])))
sh = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
lignes = []
for r in sh.find('m:sheetData', ns).findall('m:row', ns):
    ligne = {}
    for c in r.findall('m:c', ns):
        col = re.match(r'[A-Z]+', c.get('r')).group(0)
        t = c.get('t'); v = c.find('m:v', ns); i = c.find('m:is', ns)
        if t == 's' and v is not None: val = ss[int(v.text)]
        elif t == 'inlineStr' and i is not None: val = ''.join(x.text or '' for x in i.iter('{%s}t' % ns['m']))
        elif v is not None: val = float(v.text) if re.match(r'^-?[0-9.]+$', v.text) else v.text
        else: val = ''
        ligne[col] = val
    lignes.append(ligne)
print(json.dumps({ 'feuilles': feuilles, 'lignes': lignes }))`;
  const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('xlsx illisible : ' + (r.stderr || '').slice(0, 300));
  return JSON.parse(r.stdout);
};
const ouvrir = async (pc, largeur) => {
  const page = await (await browser.newContext({ viewport: { width: largeur, height: pc ? 1000 : 800 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-15T09:00:00'));
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.__dialogues = [];
  page.on('dialog', d => { page.__dialogues.push([d.type(), d.message()]); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu);
  return page;
};
const couleurs = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => { const c = getComputedStyle(e); return [e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), c.color, c.backgroundColor]; }), sel);

// ================================================================ 1. PC : rouge réservé aux alertes, un seul titre, exports
const pc = await ouvrir(true, 1400);
await pc.evaluate(() => { plOnglet = 'qualite'; plPcCampagne = null; plPcMoisQual = null; render('qualite'); });
await pc.waitForSelector('#pc-qualite');
const pastilles = await couleurs(pc, '#pc-qualite-mois .pc-pill');
const non = pastilles.filter(p => p[0] === 'Non obtenu'), oui = pastilles.filter(p => p[0] === 'Obtenu');
check(non.length >= 1 && oui.length >= 1, 'Qualité PC : des pastilles « Non obtenu » et « Obtenu » sont affichées');
for (const p of non) check(![ROUGE, ROUGE_PASTEL].includes(p[1]) && ![ROUGE, ROUGE_PASTEL].includes(p[2]), 'Qualité PC : « Non obtenu » n\'est plus rouge : ' + JSON.stringify(p));
check(await pc.evaluate(() => [...document.querySelectorAll('#pc-qualite-mois .pc-pill')].filter(e => e.textContent.trim() === 'Non obtenu').every(e => e.classList.contains('neutral'))), 'Qualité PC : « Non obtenu » en gris (pastille neutre)');
for (const p of oui) check(p[1] === 'rgb(36, 97, 58)', 'Qualité PC : « Obtenu » reste vert : ' + JSON.stringify(p));
const bandeau = await couleurs(pc, '#qualite-banner');
check(bandeau.length === 1 && bandeau[0][1] === ROUGE && bandeau[0][2] === ROUGE_PASTEL, 'Qualité PC : le bandeau de résultat positif reste rouge (vraie alerte) : ' + JSON.stringify(bandeau));
eq(await pc.evaluate(() => document.querySelectorAll('#pc-qualite .brd-title, #pc-qualite h2').length), 0, 'Qualité PC : plus de titre répété (le bandeau et l\'onglet le portent)');
check(/analyses de la laiterie/.test(await pc.evaluate(() => document.querySelector('#pc-qualite .brd-sub').textContent)), 'Qualité PC : la ligne d\'information sous le titre reste');
// exports Qualité PC : Export Excel (blanc), Export PDF (vert), puis « + Nouveau prélèvement » inchangé
const ex = await pc.evaluate(() => [...document.querySelectorAll('#pc-qualite .brd-actions button')].map(b => { const c = getComputedStyle(b); return [b.textContent.trim(), b.id, c.backgroundColor]; }));
eq(ex.map(e => [e[0], e[1]]), [['Export Excel', 'btn-export-qualite-xlsx'], ['Export PDF', 'btn-rapport-qualite'], ['+ Nouveau prélèvement', 'btn-qualite-add']], 'Qualité PC : boutons de l\'en-tête (ordre)');
eq([ex[0][2], ex[1][2], ex[2][2]], [BLANC, VERT, VERT], 'Qualité PC : Export Excel blanc, Export PDF vert, « + Nouveau prélèvement » vert (inchangé)');
// Excel de la qualité : campagne affichée seulement, valeurs saisies, cases vides pour « à saisir »
await pc.evaluate(() => { window.__saisies.length = 0; });
await pc.click('#btn-export-qualite-xlsx'); await pc.waitForFunction(() => window.__saisies.length >= 1);
let s = await pc.evaluate(() => window.__saisies[0]);
eq([s.nom, s.mime], ['qualite_campagne-2027_2027-03-15.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], 'Excel qualité : nom et type');
let x = lireXlsx(s.octets);
eq(x.feuilles, ['Prélèvements'], 'Excel qualité : feuille');
eq(x.lignes.length, 4, 'Excel qualité : en-tête + 3 prélèvements de la campagne 2027 (celui de la campagne précédente est exclu)');
eq(Object.values(x.lignes[0]), ['Date', 'Volume (L)', 'TB (g/L)', 'TP (g/L)', 'MSU (g/L)', 'Cellules (/mL)', 'Flore totale (UFC/mL)', 'Coliformes (milliers/mL)', 'Butyriques (spores/L)', 'Listéria', 'Salmonelles'], 'Excel qualité : en-têtes');
eq(Object.values(x.lignes[1]), ['08-10-2026', 388, 68.2, 54.1, 122.3, 410000, 18000, 40, 90, 'Négatif', 'Négatif'], 'Excel qualité : 1er prélèvement (MSU = TB + TP, cellules brutes)');
eq(Object.values(x.lignes[2]).slice(0, 5).concat([x.lignes[2].J, x.lignes[2].K]), ['08-01-2027', 463, 72, 56, 128, 'Négatif', 'Positif'], 'Excel qualité : prélèvement positif');
eq([x.lignes[3].A, x.lignes[3].C, x.lignes[3].F, x.lignes[3].J], ['03-03-2027', '', '', ''], 'Excel qualité : « résultats à saisir » = cases vides');
// la campagne choisie dans le sélecteur est celle de l'export
await pc.selectOption('#pl-pc-campagne', '2025'); await pc.waitForTimeout(150);
await pc.evaluate(() => { window.__saisies.length = 0; });
await pc.click('#btn-export-qualite-xlsx'); await pc.waitForFunction(() => window.__saisies.length >= 1);
s = await pc.evaluate(() => window.__saisies[0]); x = lireXlsx(s.octets);
eq([s.nom, x.lignes.length, x.lignes[1].A], ['qualite_campagne-2026_2027-03-15.xlsx', 2, '05-02-2026'], 'Excel qualité : suit la campagne choisie au sélecteur');
// Export PDF : même rapport qu'avant (octets inchangés), seul le libellé a changé
await pc.selectOption('#pl-pc-campagne', '2026'); await pc.waitForTimeout(150);
await pc.evaluate(() => { window.__saisies.length = 0; });
await pc.click('#btn-rapport-qualite'); await pc.waitForFunction(() => window.__saisies.length >= 1, null, { timeout: 15000 });
eq(await pc.evaluate(() => window.__saisies[0].nom), 'rapport-campagne_2027_2027-03-15.pdf', 'Export PDF Qualité : nom de fichier inchangé');
// Tank : titre et exports inchangés
await pc.evaluate(() => { plOnglet = 'tank'; plPcCampagne = null; plPcMoisTank = null; plPcDate = null; render('qualite'); });
eq(await pc.evaluate(() => document.querySelector('#pc-tank .brd-title').textContent), 'Tank', 'Tank PC : le titre est conservé');
eq(await pc.evaluate(() => [...document.querySelectorAll('#pc-tank .brd-actions button')].map(b => b.textContent.trim())), ['Export Excel', 'Export PDF'], 'Tank PC : exports inchangés');
// Bilan économique PC
await pc.evaluate(() => { bilanCampagneTab = 'economique'; bilanEconomiqueCampagneAffichee = 2026; bilanEconomiqueMoisAffiche = '2027-01'; render('bilan-campagne'); });
await pc.waitForSelector('#pc-economique');
eq(await pc.evaluate(() => document.querySelectorAll('#pc-economique .brd-title, #pc-economique h2').length), 0, 'Bilan économique PC : plus de titre répété');
check(/prix du lait et gain lié à la qualité/.test(await pc.evaluate(() => document.querySelector('#pc-economique .brd-sub').textContent)), 'Bilan économique PC : la ligne d\'information reste');
const eco = await pc.evaluate(() => [...document.querySelectorAll('#pc-economique .brd-actions button')].map(b => [b.textContent.trim().replace(/\s+/g, ' '), getComputedStyle(b).backgroundColor]));
eq([eco[0][0].slice(0, 15), eco[1]], ['Coefficient MSU', ['Export PDF', VERT]], 'Bilan économique PC : « Rapport de campagne (PDF) » renommé « Export PDF », même place, toujours vert');
const nonEco = await couleurs(pc, '#pc-economique .pc-pill');
check(nonEco.some(p => p[0] === 'Non obtenu') && nonEco.filter(p => p[0] === 'Non obtenu').every(p => ![ROUGE, ROUGE_PASTEL].includes(p[1]) && ![ROUGE, ROUGE_PASTEL].includes(p[2])), 'Bilan économique PC : « Non obtenu » (détail du mois) n\'est plus rouge : ' + JSON.stringify(nonEco));
// Composition du gain qualité : « Pénalités 0 € » neutre ; avec une pénalité saisie, le montant reste rouge
const penRouge = () => pc.evaluate(() => { const l = [...document.querySelectorAll('#pc-economique div')].filter(d => d.children.length === 3 && d.firstElementChild && d.firstElementChild.textContent === 'Pénalités')[0]; return l ? getComputedStyle(l.lastElementChild).color : null; });
check(await penRouge() !== null && await penRouge() !== ROUGE, 'Bilan économique PC : « Pénalités 0 € » en neutre dans la composition du gain : ' + await penRouge());
await pc.evaluate(() => { DB.penalitesBacterio = [{ id: 'pe1', dateDebut: '2027-01-10', dateFin: '2027-01-10', litrageL: 1000, cause: 'autre', commentaire: 'labo' }]; render('bilan-campagne'); });
eq(await penRouge(), ROUGE, 'Bilan économique PC : avec des pénalités, le montant reste rouge (comme avant)');
await pc.evaluate(() => { DB.penalitesBacterio = []; });
// Supprimer : toujours rouge, toujours avec confirmation
await pc.evaluate(() => { plOnglet = 'tank'; plPcDate = null; render('qualite'); });
const sup = await couleurs(pc, '#pc-rel-del');
check(sup.length === 1 && sup[0][1] === ROUGE, 'Tank PC : « Supprimer ce relevé » reste rouge : ' + JSON.stringify(sup));
pc.__dialogues.length = 0;
await pc.click('#pc-rel-del'); await pc.waitForTimeout(150);
check(pc.__dialogues.length === 1 && pc.__dialogues[0][0] === 'confirm', 'Tank PC : la suppression demande toujours sa confirmation : ' + JSON.stringify(pc.__dialogues));
check(await pc.evaluate(() => !document.getElementById('app').innerText.includes('Rapport de campagne (PDF)')), 'PC : plus aucun « Rapport de campagne (PDF) » à l\'écran');
console.log('OK 1 PC : « Non obtenu » gris, « Pénalités 0 € » neutre (rouge s\'il y en a), bandeau positif et Supprimer inchangés, un seul titre, Export Excel / Export PDF, Excel valide et limité à la campagne.');

// ================================================================ 2. échec d'export : message de charte, jamais d'alert()
await pc.evaluate(() => { plOnglet = 'qualite'; render('qualite'); saveOrShareBinaryFile = async () => { throw new Error('espace insuffisant'); }; });
pc.__dialogues.length = 0;
await pc.click('#btn-export-qualite-xlsx'); await pc.waitForSelector('#export-erreur');
check(pc.__dialogues.length === 0, 'échec d\'export : aucune boîte de dialogue (alert) : ' + JSON.stringify(pc.__dialogues));
const err = await pc.evaluate(() => { const e = document.getElementById('export-erreur'), c = getComputedStyle(e); return { classe: e.className, texte: e.textContent.replace(/\s+/g, ' ').trim(), role: e.getAttribute('role'), bg: c.backgroundColor, premier: e === document.getElementById('app').firstElementChild, bouton: document.getElementById('btn-export-qualite-xlsx').textContent, actif: !document.getElementById('btn-export-qualite-xlsx').disabled }; });
check(/msg-charte/.test(err.classe) && /L'export a échoué/.test(err.texte) && /espace insuffisant/.test(err.texte) && err.role === 'alert' && err.bg === ROUGE_PASTEL && err.premier, 'échec d\'export : message de charte (rouge, vraie erreur) en haut de l\'écran : ' + JSON.stringify(err));
eq([err.bouton, err.actif], ['Export Excel', true], 'échec d\'export : le bouton retrouve son libellé et reste utilisable');
await pc.click('#export-erreur-fermer'); eq(await pc.evaluate(() => !!document.getElementById('export-erreur')), false, 'le message se ferme');
await pc.context().close();
console.log('OK 2 échec d\'export : message de charte, aucun alert().');

// ================================================================ 3. mobile (360 et 390 px)
for (const largeur of [360, 390]) {
  const m = await ouvrir(false, largeur);
  await m.evaluate(() => { plOnglet = 'qualite'; plMoisQualite = '2027-01'; render('qualite'); });
  await m.waitForSelector('#btn-rapport-qualite');
  const bt = await m.evaluate(() => [...document.querySelectorAll('#btn-export-qualite-xlsx, #btn-rapport-qualite')].map(b => [b.textContent.trim(), b.id, getComputedStyle(b).backgroundColor, Math.round(b.getBoundingClientRect().y)]));
  eq(bt.map(b => [b[0], b[1]]), [['Export Excel', 'btn-export-qualite-xlsx'], ['Export PDF', 'btn-rapport-qualite']], largeur + ' px : Qualité mobile : Export Excel puis Export PDF');
  eq([bt[0][2], bt[1][2], bt[0][3] === bt[1][3]], [BLANC, VERT, true], largeur + ' px : Qualité mobile : Excel blanc et PDF vert sur la même rangée (comme le Tank)');
  check(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), largeur + ' px : aucun défilement horizontal');
  await m.evaluate(() => { window.__saisies.length = 0; });
  await m.click('#btn-export-qualite-xlsx'); await m.waitForFunction(() => window.__saisies.length >= 1);
  const sm = await m.evaluate(() => window.__saisies[0]); const xm = lireXlsx(sm.octets);
  eq([sm.nom, xm.lignes.length], ['qualite_campagne-2027_2027-03-15.xlsx', 4], largeur + ' px : Excel qualité mobile : campagne du mois affiché');
  // fiche prélèvement : renvoi corrigé, icône SVG, plus d'emoji, bandeau rouge conservé
  await m.evaluate(() => openQualiteSheet(findPrelevementQualiteByDate('2027-01-08')));
  const ban = await m.evaluate(() => { const b = document.getElementById('qs-banner'), c = getComputedStyle(b); return { texte: b.textContent.replace(/\s+/g, ' ').trim(), svg: !!b.querySelector('svg'), emoji: /[⚠️]/.test(b.innerHTML), visible: !b.classList.contains('hidden'), color: c.color }; });
  check(ban.visible && ban.svg && !ban.emoji && ban.color === ROUGE, largeur + ' px : fiche prélèvement : icône SVG, pas d\'emoji, bandeau rouge : ' + JSON.stringify(ban));
  check(/depuis le Bilan économique \(bloc « Pénalités bactério »\)/.test(ban.texte) && !/onglet Qualité/.test(ban.texte), largeur + ' px : renvoi corrigé : ' + ban.texte);
  await m.evaluate(() => document.querySelectorAll('.sheet-overlay').forEach(e => e.remove()));
  // Bilan économique mobile
  await m.evaluate(() => { bilanCampagneTab = 'economique'; bilanEconomiqueCampagneAffichee = 2026; bilanEconomiqueMoisAffiche = null; render('bilan-campagne'); });
  const be = await m.evaluate(() => { const b = document.getElementById('btn-export-rapport-campagne-pdf'); return [b.textContent.trim(), getComputedStyle(b).backgroundColor]; });
  eq(be, ['Export PDF', BLANC], largeur + ' px : Bilan économique mobile : « Export PDF » (même place, même aspect)');
  check(await m.evaluate(() => !document.getElementById('app').innerText.includes('Rapport de campagne (PDF)')), largeur + ' px : plus aucun « Rapport de campagne (PDF) » à l\'écran');
  await m.evaluate(() => { plOnglet = 'qualite'; render('qualite'); saveOrShareBinaryFile = async () => { throw new Error('disque plein'); }; });
  m.__dialogues.length = 0;
  await m.click('#btn-rapport-qualite'); await m.waitForSelector('#export-erreur');
  check(m.__dialogues.length === 0 && /disque plein/.test(await m.evaluate(() => document.getElementById('export-erreur').textContent)), largeur + ' px : échec d\'export mobile : message de charte, aucun alert()');
  await m.context().close();
  console.log('OK ' + largeur + ' px mobile : Export Excel + Export PDF en Qualité, « Export PDF » en Bilan économique, icône SVG, renvoi corrigé, échec d\'export sans alert().');
}
await browser.close();
