/* Impression du Tri des agnelles (mobile et PC) : les trois PDF (Feuille de tri, Liste SIEOL, Écartées) sont en PORTRAIT et remplissent la feuille A4
   (une page paysage est réduite à l'impression sur tablette) ; en-têtes jamais coupés (sur deux lignes si besoin) ; page d'export « Colonnes à afficher »
   (bouton data-colonnes-choix) : toutes cochées d'office, une décochée disparaît du PDF ET de l'Excel et de « Trier par », au moins une colonne,
   rien de gardé d'une fois sur l'autre ; les autres exports n'ont pas ce choix. Jeu SYNTHÉTIQUE, aucune donnée réelle.
   OVILOG_CAPTURES=<dossier> : enregistre aussi les PDF et les captures de la page d'export (visuels pour le propriétaire). */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP_SANS_REGLAGE as URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const CAP = process.env.OVILOG_CAPTURES || '';
const PY = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
out = { 'pages': d.page_count, 'w': d[0].rect.width, 'h': d[0].rect.height, 'entetes': [], 'textes': [], 'lignesP1': 0, 'basP1': 0 }
for i, p in enumerate(d):
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].strip()
                if not t: continue
                out['textes'].append(t)
                if i == 0 and s['color'] == 0xffffff: out['entetes'].append([t, round(s['bbox'][0], 1), round(s['bbox'][1], 1)])
                if i == 0 and t.isdigit() and len(t) == 5 and t.startswith('71'): out['lignesP1'] += 1; out['basP1'] = max(out['basP1'], s['bbox'][3])
print(json.dumps(out))`;
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-tri-imp-'));
const lirePdf = (octets, nom) => { const f = path.join(dir, nom + '.pdf'); writeFileSync(f, Buffer.from(octets)); if (CAP) writeFileSync(path.join(CAP, nom + '.pdf'), Buffer.from(octets)); const r = spawnSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error('PyMuPDF : ' + r.stderr); return JSON.parse(r.stdout); };
const jeu = () => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple' });
  const fiche = (n, id, o) => Object.assign({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, o || {});
  DB.brebis = []; DB.beliers = []; DB.lots = []; DB.agnelles = [];
  let k = 0;
  for (let m = 0; m < 25; m++) {
    const b = fiche('66' + String(9000 + m), 'b' + m, { numeroCourtTravailSieol: String(400 + m) });
    const lambs = [0, 1].map(j => ({ sexe: 'Femelle', adopte: false, eid: '2500000456' + String(71000 + (k++)), sanitaire: [], mouvements: [] }));
    if (m === 24) lambs.forEach(l => { l.triStatut = 'écartée'; });
    b.agnelages = [{ date: '2026-10-' + String(5 + (m % 20)).padStart(2, '0'), campagne: 2026, codeRepro: m % 3 ? 'MN' : 'IA', lambs }];
    DB.brebis.push(b);
  }
};
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const p = await (await browser.newContext(bureau ? { viewport: { width: 1400, height: 1000 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: CAP ? 2 : 1 })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(jeu);
  await p.evaluate(() => {
    window.__f = []; window.__xl = [];
    const o = buildXlsxWorkbook;
    buildXlsxWorkbook = async (f) => { if (!exportCapture) window.__xl.push(JSON.parse(JSON.stringify(f.map(trierFeuilleExport)))); return o(f); };
    saveOrShareBinaryFile = async (n, b) => { if (exportCapture) { exportCapture.terminer(); return; } window.__f.push({ n, b: Array.from(b) }); if (triExportFin) { const f = triExportFin; triExportFin = null; setTimeout(f, 0); } };   // même garde que la vraie fonction (essai à blanc)
  });
  await p.evaluate(() => render('agnelles'));
  await p.waitForTimeout(200);
  return p;
}
const ids = { mobile: ['#tm-export-pdf', '#tm-export-xlsx'], PC: ['#ta-export-pdf', '#ta-export'] };
for (const bureau of [false]) {   // feuille de tri à imprimer : onglet À trier du MOBILE (sur PC, l'onglet À trier est le tri par critères : test_tri_criteres)
  const nom = bureau ? 'PC' : 'mobile', p = await ouvrir(bureau);
  // 1. page d'export : « Colonnes à afficher », toutes cochées
  await p.click(ids[nom][0]);
  await p.waitForSelector('#te-colonnes');
  const cols = await p.evaluate(() => [...document.querySelectorAll('.te-col-case')].map(c => [c.dataset.col, c.checked]));
  eq(cols.map(c => c[0]), ["N° d'ordre", 'Naissance', 'Mode repro', 'Portée', 'Mère n° de travail', 'Mère classe', 'Mère lact. N-1 (L)', 'Père code IA', 'ISOL père', 'Garder', 'Écarter', 'Notes'], nom + ' : les 12 colonnes de la feuille de tri');
  check(cols.every(c => c[1]), nom + ' : toutes cochées d\'office');
  if (CAP) await p.screenshot({ path: path.join(CAP, nom + '_page_export_colonnes_toutes.png') });
  // 2. export sans rien toucher : portrait, 12 en-têtes entiers (sur deux lignes si besoin), page remplie
  await p.click('#te-exporter'); await p.waitForFunction(() => window.__f.length === 1);
  const r12 = lirePdf(await p.evaluate(() => window.__f[0].b), nom + '_feuille_12_colonnes');
  check(r12.w < r12.h && Math.round(r12.w) === 595, nom + ' : feuille de tri en portrait A4 : ' + r12.w + '×' + r12.h);
  check(!r12.textes.some(t => /\.\.\.|…/.test(t)), nom + ' : aucun texte coupé : ' + JSON.stringify(r12.textes.filter(t => /\.\.\.|…/.test(t))));
  const entetes = r12.entetes.map(e => e[0]).join(' ');
  for (const l of ['N°', "d'ordre", 'Naissance', 'Mode', 'repro', 'Portée', 'Mère', 'classe', 'Père', 'ISOL', 'Garder', 'Écarter', 'Notes']) check(entetes.includes(l), nom + ' : en-tête « ' + l + ' » présent : ' + entetes);
  check(r12.lignesP1 >= 28 && r12.basP1 > r12.h * 0.85, nom + ' : la page 1 est remplie (' + r12.lignesP1 + ' agnelles, bas à ' + Math.round(r12.basP1 / r12.h * 100) + ' %)');
  // 3. colonnes décochées : retirées du PDF et de « Trier par », au moins une colonne
  await p.evaluate(() => { window.__f = []; });
  await p.click(ids[nom][0]); await p.waitForSelector('#te-colonnes');
  check(await p.evaluate(() => [...document.querySelectorAll('.te-col-case')].every(c => c.checked)), nom + ' : rien n\'est gardé d\'une fois sur l\'autre (toutes recochées)');
  await p.selectOption('#te-c1', 'Mode repro');
  for (const l of ['Mode repro', 'Mère classe', 'Père code IA', 'ISOL père']) await p.click(`.te-col-case[data-col="${l}"]`);
  const opts = await p.evaluate(() => [...document.querySelectorAll('#te-c1 option')].map(o => o.textContent));
  check(!opts.includes('Mode repro') && !opts.includes('ISOL père') && opts.includes('Naissance'), nom + ' : « Trier par » ne propose que les colonnes cochées : ' + JSON.stringify(opts));
  eq(await p.evaluate(() => document.getElementById('te-c1').value), '', nom + ' : tri sur une colonne décochée remis à « Comme à l\'écran »');
  if (CAP) { await p.evaluate(() => { const z = document.querySelector('.te-corps'); if (z) z.scrollTop = z.scrollHeight; }); await p.screenshot({ path: path.join(CAP, nom + '_page_export_colonnes_choix.png') }); }
  await p.click('#te-exporter'); await p.waitForFunction(() => window.__f.length === 1);
  const r8 = lirePdf(await p.evaluate(() => window.__f[0].b), nom + '_feuille_8_colonnes');
  const e8 = r8.entetes.map(e => e[0]);
  eq(e8, ["N° d'ordre", 'Naissance', 'Portée', 'Mère n° de travail', 'Mère lact. N-1 (L)', 'Garder', 'Écarter', 'Notes'], nom + ' : PDF à 8 colonnes, titres sur une ligne');
  check(r8.w < r8.h && r8.lignesP1 >= 28, nom + ' : 8 colonnes, portrait, page remplie');
  // au moins une colonne : la dernière cochée ne peut pas être décochée
  await p.click(ids[nom][0]); await p.waitForSelector('#te-colonnes');
  const labels = await p.evaluate(() => [...document.querySelectorAll('.te-col-case')].map(c => c.dataset.col));
  for (const l of labels.slice(1)) await p.click(`.te-col-case[data-col="${l}"]`);
  check(await p.evaluate(() => document.querySelector('.te-col-case[data-col="N° d\'ordre"]').disabled && document.querySelector('.te-col-case[data-col="N° d\'ordre"]').checked), nom + ' : au moins une colonne (la dernière ne se décoche pas)');
  await p.click('#te-annuler');
  // 4. Excel : mêmes colonnes retirées
  await p.evaluate(() => { window.__f = []; window.__xl = []; });
  await p.click(ids[nom][1]); await p.waitForSelector('#te-colonnes');
  for (const l of ['Mode repro', 'Notes']) await p.click(`.te-col-case[data-col="${l}"]`);
  await p.click('#te-exporter'); await p.waitForFunction(() => window.__xl.length >= 1 && window.__f.some(f => /\.xlsx$/.test(f.n)));   // fichier Excel enregistré avant l'export suivant
  const xl = await p.evaluate(() => window.__xl[window.__xl.length - 1][0]);
  check(!xl.rows[0].includes('Mode repro') && !xl.rows[0].includes('Notes') && xl.rows[0].includes('Naissance') && xl.rows.every(r => r.length === xl.rows[0].length) && (!xl.colWidths || xl.colWidths.length === xl.rows[0].length), nom + ' : Excel sans les colonnes décochées : ' + JSON.stringify(xl.rows[0]));
  // 5. Liste SIEOL et Écartées : portrait
  for (const onglet of ['ecartees']) {
    await p.evaluate((o) => { window.__f = []; if (isDesktopMode()) { triPcEtat.onglet = o; } else triMobileOnglet = o; render('agnelles'); }, onglet);
    await p.click(ids[nom][0]); await p.waitForSelector('#te-exporter'); await p.click('#te-exporter'); await p.waitForFunction(() => window.__f.some(f => /\.pdf$/.test(f.n)));
    const r = lirePdf(await p.evaluate(() => window.__f.find(f => /\.pdf$/.test(f.n)).b), nom + '_' + onglet);
    check(r.w < r.h, nom + ' : ' + onglet + ' en portrait');
  }
  console.log('OK ' + nom + ' : feuille de tri en portrait remplie, 12 en-têtes entiers ; colonnes à cocher (PDF, Excel, Trier par, au moins une, rien de gardé) ; écartées en portrait.');
  await p.context().close();
}
// 6. les autres exports n'ont pas le choix des colonnes
{
  const p = await ouvrir(false);
  const sans = await p.evaluate(() => { ouvrirPageTriExport({ titre: 'Export PDF · Essai', format: 'pdf', labels: ['N°', 'Date'], lignes: [['1', '01-01-2026'], ['2', '02-01-2026']], lancer: () => {} }); const r = !document.getElementById('te-colonnes'); document.querySelector('#te-annuler').click(); return r; });
  check(sans, 'export d\'une autre liste : pas de « Colonnes à afficher »');
  // la Liste SIEOL (gardées) est aussi en portrait
  const g = await p.evaluate(() => { DB.brebis[0].agnelages[0].lambs[0].triStatut = 'gardée'; DB.agnelles.push({ id: 'g1', eid: DB.brebis[0].agnelages[0].lambs[0].eid, origine: 'née', motherEid: DB.brebis[0].eid, dateEntree: '2026-10-20', sanitaire: [], notes: [], mouvements: [] }); const D = triAgnellesDonnees(); return Array.from(buildTriAgnellesPdfBytes('gardees', D)); });
  const rg = lirePdf(g, 'liste_sieol');
  check(rg.w < rg.h && !rg.textes.some(t => /\.\.\.|…/.test(t)), 'Liste SIEOL : portrait, rien de coupé');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « IMPRESSION DU TRI DES AGNELLES » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
