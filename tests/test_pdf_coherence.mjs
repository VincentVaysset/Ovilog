/* Cohérence de tous les PDF (« PDF cohérence ») : (1) nom de l'exploitation en haut à droite, toujours lu au même endroit (repli « Ovilog » quand il est vide) ; (2) pied de page unique
   « Ovilog — [export] · [campagne] » (+ « Page n/N ») sur chaque PDF ; (3) aucun en-tête de tableau tronqué (texte blanc sur fond vert sans « ... ») ; (4) Production laitière (Tank, Calendrier du tank, Rapport de
   campagne : Bilan économique et Qualité du lait) à la charte des exports : tuiles colorées à liseré, en-tête de tableau vert #357f4b, lignes alternées ; (5) même PDF, octet pour octet, sur PC et sur mobile.
   Jeux SYNTHÉTIQUES (lib/jeux_pdf_tous.mjs), saveOrShareBinaryFile remplacé, aucune donnée réelle. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { installerCasPdf } from './lib/jeux_pdf.mjs';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
import { installerCasPdfTous } from './lib/jeux_pdf_tous.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const PY = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
fills = []; spans = []
for p in d:
    for dr in p.get_drawings():
        if dr.get('fill'): fills.append([round(c * 255) for c in dr['fill']] + [round(dr['rect'].width, 1), round(dr['rect'].height, 1), round(dr['rect'].x0, 1), round(dr['rect'].y0, 1), p.number])
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                c = s['color']; spans.append([(c >> 16) & 255, (c >> 8) & 255, c & 255, s['text'], round(s['size'], 1), round(s['bbox'][0], 1), round(s['bbox'][1], 1), p.number, 'bold' in s['font'].lower() or bool(s['flags'] & 16)])
print(json.dumps({ 'pages': d.page_count, 'largeur': d[0].rect.width, 'fills': fills, 'spans': spans }))`;
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-coh-'));
const lire = (b64, nom) => { const f = path.join(dir, nom + '.pdf'); writeFileSync(f, Buffer.from(b64, 'base64')); const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error('PyMuPDF : ' + r.stderr.slice(0, 300)); return JSON.parse(r.stdout); };
const proche = (c, hex, tol = 3) => { const h = hex.replace('#', ''), v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return [0, 1, 2].every(i => Math.abs(c[i] - v[i]) <= tol); };
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(`window.__jeuRegistre = ${jeuRegistre.toString()}`);
  await page.evaluate(installerCasPdf); await page.evaluate(installerCasPdfTous);
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const tous = (pg, nomExploitation) => pg.evaluate(async (nomE) => {
  window.__nomExploitation = nomE; const sortie = {};
  for (const k of Object.keys(window.CAS_PDF)) { const o = await window.CAS_PDF[k](); let s = ''; for (const v of o) s += String.fromCharCode(v); sortie[k] = btoa(s); }
  return sortie;
}, nomExploitation);
const P = await tous(pc, 'Ferme du Test'), M = await tous(mob, 'Ferme du Test');
const noms = Object.keys(P);
check(noms.length >= 17, 'au moins 17 PDF testés : ' + noms.length);
const PIED = /^Ovilog — .+ · (Campagne [\d/\- ]+|Année \d{4})$/;
const resultats = {};
for (const nom of noms) {
  check(P[nom] === M[nom], nom + ' : même PDF, octet pour octet, sur PC et sur mobile');
  const r = lire(P[nom], nom); resultats[nom] = r;
  // (1) nom de l'exploitation : texte gras 10,5 pt calé à droite en haut de la 1re page
  const nomSpan = r.spans.find(s => s[7] === 0 && s[3] === 'Ferme du Test' && s[4] === 10.5);
  check(nomSpan && nomSpan[5] > r.largeur / 2 && nomSpan[6] < 80, nom + ' : nom de l\'exploitation « Ferme du Test » en haut à droite');
  // (2) pied de page : une ligne « Ovilog — … · Campagne … » par page, plus « Page i/N »
  const pieds = r.spans.filter(s => s[3].startsWith('Ovilog — ') && s[4] === 8);
  check(pieds.length === r.pages && pieds.every(s => PIED.test(s[3].trim())), nom + ' : pied de page « Ovilog — [export] · [campagne] » sur chaque page : ' + JSON.stringify(pieds.map(s => s[3])));
  for (let i = 1; i <= r.pages; i++) check(r.spans.some(s => s[7] === i - 1 && s[3].trim() === 'Page ' + i + '/' + r.pages), nom + ' : « Page ' + i + '/' + r.pages + ' »');
  // (3) en-têtes de tableau : texte blanc sur fond vert, jamais tronqué
  const blancs = r.spans.filter(s => s[0] >= 250 && s[1] >= 250 && s[2] >= 250 && s[3].trim());
  const tronques = blancs.filter(s => /\.\.\.|…/.test(s[3]));
  check(tronques.length === 0, nom + ' : en-tête(s) de tableau tronqué(s) : ' + JSON.stringify(tronques.map(s => s[3])));
}
console.log('OK ' + noms.length + ' PDF : nom de l\'exploitation, pied unique « Ovilog — [export] · [campagne] », « Page i/N », aucun en-tête tronqué, identiques sur PC et mobile.');
// repli quand le nom est vide
const V = await tous(pc, '');
for (const nom of ['calendrier', 'bilan_complet', 'bilan_lactation', 'inventaire']) { const r = lire(V[nom], 'vide_' + nom); check(r.spans.some(s => s[7] === 0 && s[3] === 'Ovilog' && s[4] === 10.5), nom + ' : sans nom d\'exploitation, repli « Ovilog » en haut à droite'); }
console.log('OK repli « Ovilog » quand le nom de l\'exploitation est vide (même fonction pour les deux moteurs PDF).');
// (4) Production laitière à la charte des exports
const VERT = '#357f4b', ALT = '#f6f1e4';
for (const nom of ['calendrier', 'rapport']) {
  const r = resultats[nom];
  const teintes = ['#e3f3e6', '#e6f0fa', '#fbeed7', '#fbe3e0'];
  const tuiles = r.fills.filter(f => f[3] > 30 && f[4] > 35 && f[4] < 70 && teintes.some(t => proche(f, t, 2)));
  if (nom !== 'calendrier') check(tuiles.length >= 3, nom + ' : tuiles colorées (pastel) à liseré, trouvées : ' + tuiles.length);
  const lisere = r.fills.filter(f => Math.abs(f[3] - 4) < 0.6 && f[4] > 35 && f[4] < 70);
  if (nom !== 'calendrier') check(lisere.length >= 3, nom + ' : liseré gauche de 4 pt sur les tuiles : ' + lisere.length);
  check(r.fills.some(f => proche(f, VERT, 2) && f[3] > 300 && f[4] >= 14 && f[4] <= 28), nom + ' : en-tête de tableau vert ' + VERT + ' pleine largeur');
  check(r.fills.filter(f => proche(f, ALT, 2) && f[3] > 300).length >= 3, nom + ' : lignes alternées ' + ALT);
  check(!r.fills.some(f => f[0] === 246 && f[1] === 243 && f[2] === 234), nom + ' : plus de beige neutre ancien (#f6f3ea)');
  check(!r.spans.some(s => /\.\.\.|…/.test(s[3])), nom + ' : aucun texte coupé (« ... ») : ' + JSON.stringify(r.spans.filter(s => /\.\.\.|…/.test(s[3])).map(s => s[3])));
}
console.log('OK Production laitière (Calendrier du tank, Rapport de campagne) : tuiles colorées à liseré, en-tête de tableau vert, lignes alternées.');
await browser.close();
console.log('\nTOUS LES TESTS « COHÉRENCE DES PDF » SONT PASSÉS.');
