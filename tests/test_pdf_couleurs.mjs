/* Couleurs des PDF = charte, source unique (PDF_CHARTE ; PDF_COULEURS et PDF_PL_COUL en dérivent) : sur chaque PDF (Calendrier du tank, Rapport de campagne, Bilan de lactation, Bilan de reproduction),
   le filet d'en-tête est EXACTEMENT le vert Ovilog #357f4b (à l'arrondi du PDF près), les titres de section sont en vert foncé #2f6e44 (texte et chiffres), et plus aucune trace des anciennes couleurs hors charte
   (vert #3c8a55, bleu #3f7fb0, corail #c1402c, ambre #b3760a). Même PDF, octet pour octet, sur PC et sur mobile. Jeu SYNTHÉTIQUE, saveOrShareBinaryFile remplacé, aucune donnée réelle. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { installerCasPdf } from './lib/jeux_pdf.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const PY = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
fills = []; textes = []
for p in d:
    for dr in p.get_drawings():
        if dr.get('fill'): fills.append([round(c * 255) for c in dr['fill']] + [round(dr['rect'].height * 10) / 10, round(dr['rect'].width)])
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                c = s['color']; textes.append([(c >> 16) & 255, (c >> 8) & 255, c & 255, s['text'].strip(), round(s['size'], 1)])
print(json.dumps({ 'fills': fills, 'textes': textes }))`;
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-pdfc-'));
function lire(b64, nom) { const f = path.join(dir, nom + '.pdf'); writeFileSync(f, Buffer.from(b64, 'base64')); const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error('PyMuPDF : ' + r.stderr.slice(0, 300)); return JSON.parse(r.stdout); }
const proche = (c, hex, tol = 2) => { const h = hex.replace('#', ''), v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return [0, 1, 2].every(i => Math.abs(c[i] - v[i]) <= tol); };
const VERT = '#357f4b', VERT_FONCE = '#2f6e44', ANCIENNES = { 'vert #3c8a55': '#3c8a55', 'bleu #3f7fb0': '#3f7fb0', 'corail #c1402c': '#c1402c', 'ambre #b3760a': '#b3760a' };
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(installerCasPdf);
  await page.evaluate(() => {
    window.b64 = u8 => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
    window.CAS_PDF.prod = async () => {
      DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test' });
      DB.laitTank = [{ date: '2025-10-01', quantite: 200 }, { date: '2025-12-04', quantite: 300 }, { date: '2026-07-31', quantite: 130 }];
      DB.prelevementsQualite = [{ id: 'p1', date: '2025-12-05', volumeLait: 310, tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif', campagne: 2026 }];
      DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-07-30', dateFin: '2026-07-31', cause: 'salmonelles', litrageL: 1200, commentaire: 'test' }];
      DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
      return { calendrier: buildCalendrierTankPdfBytes(2025), rapport: buildRapportCampagnePdfBytes(2025) };
    };
  });
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const obtenir = (pg) => pg.evaluate(async () => {
  const sortie = {};
  const prod = await window.CAS_PDF.prod(); for (const k in prod) sortie[k] = window.b64(prod[k]);
  for (const k of ['bilan_lactation', 'bilan_complet']) sortie[k] = window.b64(await window.CAS_PDF[k]());
  return sortie;
});
const P = await obtenir(pc), M = await obtenir(mob);
let nPdf = 0;
for (const nom of Object.keys(P)) {
  check(P[nom] === M[nom], nom + ' : même PDF, octet pour octet, sur PC et sur mobile');
  const r = lire(P[nom], nom);
  check(r.fills.some(f => proche(f, VERT) && f[2 + 1] >= 1.1 && f[2 + 1] <= 2.3 && f[4] > 400), nom + ' : filet d\'en-tête en vert Ovilog ' + VERT);
  check(r.textes.some(t => proche(t, VERT_FONCE) && t[3].length > 3), nom + ' : logo et titres de section en vert foncé ' + VERT_FONCE);
  for (const [lib, hex] of Object.entries(ANCIENNES)) check(!r.fills.some(f => proche(f, hex, 1)) && !r.textes.some(t => proche(t, hex, 1)), nom + ' : plus de ' + lib + ' (hors charte)');
  nPdf++;
}
console.log('OK couleurs des PDF : ' + nPdf + ' PDF (Tank, Calendrier, Rapport, Bilan de lactation, Bilan de reproduction) : filet #357f4b, titres #2f6e44, plus d\'ancienne couleur, identiques sur PC et mobile.');
await browser.close();
console.log('\nTOUS LES TESTS « COULEURS DES PDF » SONT PASSÉS.');
