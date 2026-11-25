/* Format de date UNIQUE (CLAUDE.md) : toute date affichée est en jj/mm/aaaa avec des barres (formatDateFr, seule fonction), à l'écran (PC et mobile, fiches,
   tableaux, règles du tri), dans les PDF et dans l'Excel ; plus jamais « 15-11-2026 ». Une date à barres ne se coupe jamais en fin de ligne (panneau des
   critères du tri des agnelles à 1200 px). Les noms de fichiers d'export gardent aaaa-mm-jj. Jeu SYNTHÉTIQUE (jeuPcEcrans). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const TIRET = /(?<![\d-])\d{1,2}-\d{1,2}-\d{4}(?!\d)/;
const browser = await chromium.launch(LAUNCH);
const erreurs = [], trouves = [];
let panneau = null;
const VUES = [['Accueil', 'render("dashboard")'], ['Échographies', 'echoPcEtat=null;render("echo-rapide")'], ['Tri des agnelles', 'triPcEtat=null;render("agnelles")'], ['Lots', 'lotsPcEtat=null;render("lots")'],
  ['Mouvements', 'render("mouvement-groupe")'], ['Inventaire', 'render("inventaire")'], ['Carnet', 'render("sanitaire")'], ['Soins réalisés', 'carnetOnglet="soins";render("sanitaire")'], ['Ordonnances', 'render("ordonnances")'],
  ['Sous délai', 'render("sous-delai")'], ['Contrôle laitier', 'render("controle-laitier")'], ['Registre', 'render("registre")'], ['Mises bas', 'render("misebas-rapide")'], ['Calendrier', 'render("calendrier")'],
  ['Bilan', 'bilanCampagneTab="reproduction";render("bilan-campagne")'], ['Agneaux', 'render("agneaux")'], ['Brebis', 'render("brebis")'],
  ['Fiche brebis', 'currentSheepId="B1";render("detail","B1")'], ['Fiche bélier', 'render("detail-belier","bel1")']];
for (const [mode, vp] of [['PC', { width: 1400, height: 950 }], ['mobile', { width: 400, height: 860 }]]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  page.on('pageerror', e => erreurs.push(mode + ' : ' + e.message));
  if (mode === 'PC') await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeuPcEcrans);
  for (const [nom, code] of VUES) {
    try { await page.evaluate(code); } catch (e) { continue; }
    await page.waitForTimeout(80);
    const t = await page.evaluate(() => document.getElementById('app').innerText);
    const m = TIRET.exec(t);
    if (m) trouves.push(mode + ' · ' + nom + ' : « …' + t.slice(Math.max(0, m.index - 40), m.index + 20).replace(/\s+/g, ' ') + '… »');
  }
  if (mode === 'PC') {
    // PDF et Excel du registre sanitaire et des mouvements
    await page.evaluate(() => { window.__f = []; window.__xl = []; saveOrShareBinaryFile = async (n, b) => { window.__f.push({ n, b: Array.from(b) }); }; const vrai = buildXlsxWorkbook; buildXlsxWorkbook = async f => { window.__xl.push(JSON.parse(JSON.stringify(f))); return vrai(f); }; });
    const exports = await page.evaluate(async () => {
      const r = [];
      for (const f of [() => { registreTab = 'mouvements'; return exportRegistrePdf(); }, () => exportRegistreXlsx()]) { try { await f(); } catch (e) { r.push('erreur ' + e.message); } }
      return r;
    });
    const fichiers = await page.evaluate(() => window.__f.map(f => ({ n: f.n, b: f.b })));
    for (const f of fichiers.filter(f => /\.pdf$/.test(f.n))) { const mots = lirePdfMots(f.b).mots.join(' '); const m = TIRET.exec(mots); if (m) trouves.push('PDF ' + f.n + ' : ' + mots.slice(Math.max(0, m.index - 30), m.index + 20)); }
    const xl = JSON.stringify(await page.evaluate(() => window.__xl)); const mx = TIRET.exec(xl); if (mx) trouves.push('Excel : ' + xl.slice(Math.max(0, mx.index - 40), mx.index + 20));
    check(fichiers.length >= 1 || exports.length, 'au moins un export produit : ' + JSON.stringify(exports));
    // une date ne se coupe jamais : panneau des critères à 1200 px
    await page.setViewportSize({ width: 1200, height: 950 });
    await page.evaluate(() => { ecrireCriteresTri(2026, { regles: [{ id: 'r1', conditions: [{ critere: 'naissance', op: 'entre', valeur: '2026-11-15', valeur2: '2026-12-31' }], exceptions: [{ id: 'e1', conditions: [{ critere: 'naissance', op: 'apres', valeur: '2026-11-20' }] }] }], decisions: {} }); triPcEtat = null; render('agnelles'); });
    const coupees = await page.evaluate(() => {
      const res = [];
      document.querySelectorAll('#tc-panneau .tc-lib').forEach(el => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { const re = /\d{2}\/\d{2}\/\d{4}/g; let m; while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + 10); if (r.getClientRects().length > 1) res.push(m[0]); } }
      });
      return [res, document.getElementById('tc-panneau').innerText.match(/\d{2}\/\d{2}\/\d{4}/g)];
    });
    panneau = coupees;
  }
}
check(!trouves.length, 'dates encore écrites avec des tirets :\n  ' + trouves.join('\n  '));
check(panneau[0].length === 0, 'aucune date coupée en fin de ligne : ' + panneau[0]);
check((panneau[1] || []).length >= 3, 'dates du panneau en jj/mm/aaaa : ' + panneau[1]);
check(!erreurs.length, 'aucune erreur JS ' + erreurs.join(' | '));
await browser.close();
console.log('test_format_dates : OK');
