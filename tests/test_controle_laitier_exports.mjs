/* Exports du Contrôle laitier (PDF + Excel) alignés sur l'écran : colonnes N° court, Date de mise bas, C1, C2, C3 (plus de colonne « Cumul campagne » ; le champ cumul reste dans le modèle).
   PDF relu avec PyMuPDF (ordre des colonnes de gauche à droite, lignes dans le même ordre, en-tête non coupé), même PDF (mêmes octets) sur PC et sur mobile, même nom de fichier ;
   Excel : mêmes colonnes dans le même ordre. Aucune écriture. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(desktop) {
  const page = await (await browser.newContext()).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (desktop) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
const LIGNES = [
  { courtSieol: '17', c1: 1200, c2: 1350, c3: null, dateMab: '2026-02-10', cumul: 2550 },
  { courtSieol: '18', c1: null, c2: null, c3: null, dateMab: null, cumul: 0 },
  { courtSieol: '1021', c1: 980, c2: 1010, c3: 995, dateMab: '2026-01-05', cumul: 2985 }];
async function sortie(pg) {
  return pg.evaluate(async lignes => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
    DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test' });
    const avant = JSON.stringify(DB), saisies = [], feuilles = [];
    saveOrShareBinaryFile = async function (nom, bytes, mime) { saisies.push({ nom, mime, b64: (u8 => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); })(bytes) }); };
    const ox = buildXlsxWorkbook; buildXlsxWorkbook = async f => { feuilles.push(JSON.parse(JSON.stringify(f))); return ox(f); };
    await exportControleLaitierPdf(lignes); await exportControleLaitierXlsx(lignes);
    return { saisies: saisies.map(s => ({ nom: s.nom, mime: s.mime, b64: s.nom.endsWith('.pdf') ? s.b64 : '' })), feuilles, intact: JSON.stringify(DB) === avant, saves: window.__saves };
  }, LIGNES);
}
const mob = await sortie(await ouvrir(false)), pc = await sortie(await ouvrir(true));
eq(mob.saisies.map(s => s.nom), ['controle-laitier_2026-10-03.pdf', 'controle-laitier_2026-10-03.xlsx'], 'noms de fichier');
check(mob.saisies[0].b64 === pc.saisies[0].b64 && mob.saisies[0].b64.length > 500, 'même PDF (mêmes octets) sur PC et sur mobile');
eq(JSON.stringify(mob.feuilles), JSON.stringify(pc.feuilles), 'même Excel sur PC et sur mobile');
check(mob.intact && mob.saves === 0 && pc.intact && pc.saves === 0, 'aucune écriture');

// Excel : colonnes de l'écran, sans cumul
const rows = mob.feuilles[0][0].rows;
eq(rows[0], ['N° court', 'Date de mise bas', 'C1 (mL)', 'C2 (mL)', 'C3 (mL)'], 'Excel : colonnes');
eq(rows[1], ['17', '10-02-2026', 1200, 1350, ''], 'Excel : ligne 17');
eq(rows[2], ['18', '', '', '', ''], 'Excel : ligne sans contrôle ni mise bas');
eq(rows[3], ['1021', '05-01-2026', 980, 1010, 995], 'Excel : ligne 1021');
check(!JSON.stringify(rows).match(/cumul/i), 'Excel : plus de colonne cumul');

// PDF : positions des mots lues avec PyMuPDF
const f = path.join(mkdtempSync(path.join(tmpdir(), 'ovilog-cl-')), 'cl.pdf'); writeFileSync(f, Buffer.from(mob.saisies[0].b64, 'base64'));
const r = spawnSync('python3', ['-I', '-c', 'import sys, json\ntry:\n import pymupdf as m\nexcept Exception:\n print("SANS"); sys.exit(0)\nd=m.open(sys.argv[1])\nprint(json.dumps({"pages": d.page_count, "mots": [[w[0], w[1], w[4]] for p in d for w in p.get_text("words")]}))', f], { encoding: 'utf8' });
if ((r.stdout || '').trim() === 'SANS' || !r.stdout) console.log('PyMuPDF absent : lecture du PDF ignorée');
else {
  const { pages, mots } = JSON.parse(r.stdout);
  const texte = mots.map(w => w[2]);
  check(pages === 1, 'PDF sur une page : ' + pages);
  check(!texte.some(t => /cumul|campagne/i.test(t)), 'PDF : plus de colonne « Cumul campagne »');
  const x = t => { const w = mots.find(m => m[2] === t); check(w, 'mot absent du PDF : ' + t); return w; };
  const ent = ['N°', 'Date', 'C1', 'C2', 'C3'].map(x);
  check(ent.every((w, i) => i === 0 || w[0] > ent[i - 1][0]) && ent.every(w => Math.abs(w[1] - ent[0][1]) < 3), 'PDF : en-tête N° court, Date de mise bas, C1, C2, C3 de gauche à droite sur une ligne');
  check(['court', 'de', 'mise', 'bas', '(mL)'].every(t => texte.includes(t)), 'PDF : en-têtes complets, non coupés');
  const ligne17 = ['17', '10-02-2026', '1200', '1350'].map(x);
  check(ligne17.every((w, i) => i === 0 || w[0] > ligne17[i - 1][0]) && ligne17.every(w => Math.abs(w[1] - ligne17[0][1]) < 3), 'PDF : ligne 17 dans l\'ordre N° court, date, C1, C2');
  const y = t => x(t)[1];
  check(y('17') < y('1021') && y('10-02-2026') < y('05-01-2026'), 'PDF : lignes dans l\'ordre de l\'écran');
  check(!texte.includes('2550') && !texte.includes('2985'), 'PDF : aucun cumul affiché');
}
console.log('OK : PDF et Excel du Contrôle laitier = N° court, Date de mise bas, C1, C2, C3 (sans cumul), même PDF sur PC et mobile, aucune écriture.');
await browser.close();
