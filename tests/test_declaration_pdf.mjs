/* Déclaration annuelle : PDF à la charte commune (bandeau vert Ovilog, tuiles colorées, pied de page ; même fonction pdfProdDoc que Tank, Qualité et Rapport de campagne).
   Vérifié : le clic sur « Exporter (PDF) » génère un fichier « declaration-annuelle_<année>_<date>.pdf » ; MÊMES octets sur mobile et sur PC ; contenu = chiffres de l'écran
   (recensement, 3 chiffres du ratio, ratio à 2 décimales et virgule (« 0,75 »), seuil indicatif) ; cas « Non disponible » et « Données insuffisantes » ; une seule page ; le fichier s'ouvre et se rend
   (PyMuPDF : texte relu, en-tête vert en haut de page, pas de page noir et blanc) ; aucune écriture de données. saveOrShareBinaryFile REMPLACÉ. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-decl-'));

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 420, height: 1400 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  return page;
}
const jeu = (page, premiereEntree, annee) => page.evaluate(([pe, an]) => {
  window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  const b = (n, entree, agn) => ({ id: 'b' + n, eid: '250 0162991000' + n, statut: 'active', dateEntree: entree, mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: agn || [], createdAt: 1 });
  const lamb = (vendu, k) => ({ eid: 'l' + k, sexe: 'Mâle', mouvements: vendu ? [{ type: 'Vendu', date: '2025-05-10', acheteur: 'X' }] : [] });
  DB.brebis = [b(1, pe, [{ date: '2025-02-01', lambs: [lamb(true, 1), lamb(true, 2), lamb(false, 3)] }]), b(2, pe, [{ date: '2025-03-01', lambs: [lamb(true, 4), lamb(false, 5)] }]), b(3, pe), b(4, pe)];
  DB.beliers = [{ id: 'be1', eid: '250 0162991000b1', statut: 'actif', dateEntree: pe, mouvements: [] }]; DB.agnelles = [];
  window.__avant = JSON.stringify(DB);
  window.__saisies = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, b64: (() => { let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); })() }); };
  declarationAnneeSelectionnee = an; render('declaration-annuelle');
}, [premiereEntree, annee]);
async function exporter(page) {
  await page.evaluate(() => { window.__saisies = []; });
  await page.click('#btn-export-declaration-pdf');
  await page.waitForFunction(() => window.__saisies.length === 1);
  return page.evaluate(() => window.__saisies[0]);
}
// PyMuPDF : texte, nombre de pages, couleur du pixel en haut au milieu de la page 1 (bandeau vert) et part de pixels colorés
function lirePdf(nom, b64) {
  const f = path.join(dir, nom); writeFileSync(f, Buffer.from(b64, 'base64'));
  const py = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
p = d[0]
pix = p.get_pixmap(dpi=50)
vert = 0
for yy in range(0, int(pix.height * 0.16)):
    for xx in range(0, pix.width):
        r, g, b = pix.pixel(xx, yy)[:3]
        if g > r + 25 and g > b + 25: vert += 1
col = 0
for yy in range(0, pix.height, 2):
    for xx in range(0, pix.width, 2):
        r, g, b = pix.pixel(xx, yy)[:3]
        if max(r, g, b) - min(r, g, b) > 30: col += 1
print(json.dumps({ 'pages': d.page_count, 'texte': [q.get_text() for q in d], 'vert': vert, 'colores': col, 'taille': [p.rect.width, p.rect.height] }))
pix.save(sys.argv[2])`;
  const r = spawnSync('python3', ['-I', '-c', py, f, f + '.png'], { encoding: 'utf8' });
  check(r.status === 0, 'PyMuPDF ouvre et rend le PDF : ' + (r.stderr || '').slice(0, 300));
  return JSON.parse(r.stdout);
}
const norm = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

const mob = await ouvrir(false), pc = await ouvrir(true);
const sorties = {};
for (const [nom, page] of [['mobile', mob], ['PC', pc]]) {
  // ---- cas nominal 2026 : chiffres relus de declarationAnnuelleChiffres
  await jeu(page, '2024-06-01', 2026);
  const c = await page.evaluate(() => declarationAnnuelleChiffres(2026));
  const s = await exporter(page);
  check(/^declaration-annuelle_2026_\d{4}-\d{2}-\d{2}\.pdf$/.test(s.nom) && s.nom.includes('2026-10-03'), nom + ' : nom de fichier ' + s.nom);
  eq(s.mime, 'application/pdf', nom + ' : type MIME');
  sorties[nom] = { nominal: s };
  const pdf = lirePdf(nom + '_nominal.pdf', s.b64);
  eq(pdf.pages, 1, nom + ' : une seule page');
  const t = norm(pdf.texte[0]);
  const ratioTxt = c.ratio.toFixed(2).replace('.', ',');
  for (const x of ['Déclaration annuelle', 'Déclaration 2026', 'Recensement au 1er janvier 2026', 'Brebis présentes', 'Béliers présents', 'Agnelles >6 mois présentes', 'Agneaux nés en 2025',
    'Ratio PAC (aide ovine) · 2025', 'Brebis présentes au 1er janvier 2025', 'Agneaux vendus en 2025', 'Ratio', ratioTxt, 'agneaux vendus ÷ brebis présentes', 'Seuil réglementaire indicatif', 'Page 1/1'])
    check(t.includes(x), nom + ' : le PDF contient « ' + x + ' » : ' + t.slice(0, 500));
  check(/\d,\d\d/.test(ratioTxt) && !t.includes(String(c.ratio) + ' ') || ratioTxt === String(c.ratio), nom + ' : ratio à 2 décimales dans le PDF');
  // chiffres de l'écran dans le PDF
  for (const v of [c.recensement.brebis, c.recensement.beliers, c.recensement.agnelles, c.recensement.agneauxNes, c.brebisRatio, c.agneauxNesRatio, c.agneauxVendusRatio])
    check(new RegExp('(^| )' + v + '( |$)').test(t), nom + ' : le chiffre ' + v + ' figure dans le PDF');
  // charte : bandeau vert Ovilog en haut, page colorée (pas de noir et blanc)
  check(pdf.vert > 150, nom + ' : en-tête vert Ovilog (titre et filet verts) en haut de page : ' + pdf.vert + ' pixels verts');
  check(pdf.colores > 100, nom + ' : page colorée (tuiles, pastilles) : ' + pdf.colores + ' échantillons colorés');
  check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), nom + ' : aucune écriture de données');
  console.log('OK ' + nom + ' : PDF nominal (1 page, en-tête vert, tuiles, ratio ' + ratioTxt + ').');

  // ---- Non disponible (aucune brebis au 1er janvier de l'année précédente)
  await jeu(page, '2025-06-01', 2026);
  const s2 = await exporter(page); sorties[nom].nd = s2;
  const t2 = norm(lirePdf(nom + '_nd.pdf', s2.b64).texte[0]);
  check(t2.includes('Non disponible') && t2.includes('Ratio'), nom + ' : « Non disponible » dans le PDF');
  // ---- Données insuffisantes
  await jeu(page, '2026-01-01', 2026);
  const s3 = await exporter(page); sorties[nom].insuf = s3;
  const pdf3 = lirePdf(nom + '_insuf.pdf', s3.b64);
  const t3 = norm(pdf3.texte[0]);
  check(t3.includes('Données insuffisantes (aucune donnée dans l\'appli avant 2026)') && !t3.includes('Seuil réglementaire') && pdf3.pages === 1, nom + ' : « Données insuffisantes » dans le PDF, sans seuil');
  // ---- autre année : nom de fichier
  await jeu(page, '2024-06-01', 2025);
  const s4 = await exporter(page);
  check(/^declaration-annuelle_2025_/.test(s4.nom) && norm(lirePdf(nom + '_2025.pdf', s4.b64).texte[0]).includes('Déclaration 2025'), nom + ' : année 2025 dans le nom et le titre');
  console.log('OK ' + nom + ' : Non disponible, Données insuffisantes, autre année.');
}
// ---- parité mobile / PC : mêmes octets
for (const k of ['nominal', 'nd', 'insuf']) {
  check(sorties.mobile[k].b64 === sorties.PC[k].b64, 'PDF « ' + k + ' » identique octet pour octet sur mobile et sur PC');
  eq(sorties.mobile[k].nom, sorties.PC[k].nom, 'même nom de fichier (' + k + ')');
}
console.log('OK parité : mêmes octets et même nom sur mobile et PC.');
await browser.close();
console.log('\nTOUS LES TESTS DU PDF DÉCLARATION ANNUELLE SONT PASSÉS');
