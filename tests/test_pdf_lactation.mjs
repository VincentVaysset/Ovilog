/* PDF « Bilan de lactation » : tient sur 1 page A4 avec, en plus des 3 tuiles et du tableau comparatif, les deux histogrammes mensuels de la page PC (litrage du tank en milliers de litres, brebis présentes avec trait pointillé de moyenne) ;
   mêmes chiffres que la page PC, résumé de campagne compris (dénominateur « mises bas du résumé »), et MÊME PDF, octet pour octet, sur PC et sur mobile (avant : le PC seul tenait compte du résumé). Cas sans tank ni effectif : notes à la place des barres.
   Jeu SYNTHÉTIQUE, saveOrShareBinaryFile remplacé, aucune donnée réelle. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const PY = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
fills = []; texte = ''
for p in d:
    texte += p.get_text() + '\\n'
    for dr in p.get_drawings():
        if dr.get('fill'): fills.append([round(c * 255) for c in dr['fill']] + [round(dr['rect'].width, 1), round(dr['rect'].height, 1)])
print(json.dumps({ 'pages': d.page_count, 'taille': [d[0].rect.width, d[0].rect.height], 'fills': fills, 'texte': texte }))`;
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-lact-'));
let n = 0;
function lire(octets) { const f = path.join(dir, 'l' + (++n) + '.pdf'); writeFileSync(f, Buffer.from(octets)); const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error('PyMuPDF : ' + r.stderr.slice(0, 300)); return JSON.parse(r.stdout); }
const proche = (c, rgb, tol = 3) => [0, 1, 2].every(i => Math.abs(c[i] - rgb[i]) <= tol);
const hex = h => [0, 2, 4].map(i => parseInt(h.slice(1 + i, 3 + i), 16));
const VERT = hex('#357f4b'), PALE = hex('#357f4b').map(v => Math.round(v * 0.55 + 255 * 0.45)), VFONCE = hex('#2f6e44');   // audit charte Q : barres vert #357f4b, pic vert foncé #2f6e44 (plus de vert pâle)
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__saves = 0; saveData = function () { window.__saves++; return true; };
    window.octets = (c) => { const u = buildBilanLactationPdfBytes(c); let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
    window.jeuBase = () => {
      DB = migrateData({}); DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2025-10-01'; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test' });
      const f = (i) => ({ id: 'b' + i, eid: '2500000129' + String(9000 + i), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
      DB.brebis = [f(1), f(2), f(3)]; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.laitTank = [{ date: '2025-11-02', quantite: 4200 }, { date: '2026-01-10', quantite: 5100 }];
    };
  });
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const les2 = async (code) => { const r = []; for (const pg of [pc, mob]) { await pg.evaluate(code); r.push(await pg.evaluate(() => octets(2025))); } return r; };

// ================================================================ 1. campagne avec tank et effectif : 1 page, 2 histogrammes, mêmes barres que la page PC
const [bp, bm] = await les2(() => jeuBase());
check(bp === bm, 'même PDF, octet pour octet, sur PC et sur mobile');
const r = lire(Buffer.from(bp, 'base64'));
eq([r.pages, Math.round(r.taille[0]), Math.round(r.taille[1])], [1, 595, 842], 'une seule page A4 portrait');
for (const t of ['Bilan de lactation', 'Litrage par mois', 'Brebis présentes, moyenne mensuelle', 'en milliers de litres', 'moyenne 3', '4,2', '5,1']) check(r.texte.includes(t), 'texte « ' + t + ' » présent dans le PDF');
for (const m of ['Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep']) check(r.texte.includes(m), 'mois ' + m + ' en abscisse');
const barres = r.fills.filter(f => f[3] > 25 && f[3] < 45 && f[4] > 0.9 && f[4] < 90 && (proche(f, VERT) || proche(f, VFONCE)));
eq(barres.length, 14, 'barres : 2 mois de tank + 12 mois d\'effectif');
eq(barres.filter(f => proche(f, VFONCE)).length, 1, 'une seule barre en vert foncé : le mois de pointe du litrage (janvier, 5,1) ; les autres en vert de la charte');
const hauteurs = barres.slice(0, 2).map(f => f[4]); check(hauteurs[0] < hauteurs[1] && Math.abs(hauteurs[0] / hauteurs[1] - 4200 / 5100) < 0.03, 'hauteurs proportionnelles aux litres : ' + hauteurs.join(' / '));
console.log('OK 1 PDF : 1 page A4, tuiles + tableau + deux histogrammes (14 barres, pointe en vert foncé, moyenne en pointillé), identique sur PC et mobile.');

// ================================================================ 2. résumé de campagne : mêmes chiffres que la page PC, sur PC comme sur mobile
const [rp, rm] = await les2(() => {
  jeuBase(); DB.brebis = []; DB.laitTank = [];
  DB.bilanLactationSaisie = [{ campagne: 2025, litrageTotal: 108178, brebisTraite: 351, brebisPresentes: 379 }];
  DB.resumesCampagne = { 2025: resumeDepuisSaisie(2025, RESUME_EXTERNE_2026.valeurs, RESUME_EXTERNE_2026.source) };
});
check(rp === rm, 'avec un résumé de campagne : même PDF, octet pour octet, sur PC et sur mobile (le PC seul tenait compte du résumé)');
const r2 = lire(Buffer.from(rp, 'base64'));
for (const t of ['108178,0 L', '351', '308,2 L', '285,4 L', '96,7 %', '363']) check(r2.texte.includes(t) || r2.texte.includes(t.replace(',0', '')), 'chiffre « ' + t + ' » (page PC) dans le PDF : ' + r2.texte.replace(/\s+/g, ' ').slice(0, 300));
check(r2.texte.includes('Aucune saisie tank sur cette campagne.'), 'sans tank : note à la place du premier histogramme');
eq(r2.pages, 1, 'toujours 1 page');
console.log('OK 2 résumé de campagne : 96,7 % = 351 / 363, identique sur PC et mobile ; sans tank, notes à la place des barres.');
eq(await pc.evaluate(() => window.__saves), 0, 'aucune sauvegarde (lecture seule)');
await browser.close();
console.log('\nTOUS LES TESTS « PDF BILAN DE LACTATION » SONT PASSÉS.');
