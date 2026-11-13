/* Tri des exports (PC et mobile) : « Export PDF » / « Export Excel » d'une liste ouvre la page de tri (essai à blanc, rien d'enregistré) ; « Trier par »
   et « Puis par » proposent EXACTEMENT les colonnes du fichier ; sens adapté (A → Z, 1 → 9, Ancien → récent) ; cases vides toujours en bas ; aperçu ;
   Annuler = rien ; Exporter = le fichier, lignes dans l'ordre choisi, contenu inchangé ; « Comme à l'écran » = ordre de l'écran ; exports exclus
   (Registre…) et liste de moins de 2 lignes = export direct. saveOrShareBinaryFile REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP_SANS_REGLAGE as URL_APP } from './lib/config.mjs';   // sans « ?sans-tri-export » : la page de tri est active
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: ['Vaccin B'], antibiotiques: ['Produit A', 'Produit C'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = {};
  const f = (n, id, court, long) => ({ id, eid: '2500000456' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], numeroCourtTravailSieol: court, numeroLongTravailSieol: long });
  DB.brebis = [f('60103', 'b1', '601', ''), f('60104', 'b2', '602', '160002'), f('60105', 'b3', '603', '160003')];
  const s = (p, d) => ({ type: 'Traitement', sousType: 'Antibiotique', produit: p, date: d, quantiteCc: 2, voie: 'Orale', dureeJours: 1, intervenant: 'Éleveur' });
  DB.brebis[0].sanitaire = [s('Produit C', '2026-11-05')]; DB.brebis[1].sanitaire = [s('Produit A', '2026-11-02')]; DB.brebis[2].sanitaire = [s('Produit A', '2026-11-10')];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.__fichiers = [];
  saveOrShareBinaryFile = async (nom) => { if (exportCapture) { exportCapture.terminer(); return; } if (triExportFin) { const f = triExportFin; triExportFin = null; setTimeout(f, 0); } window.__fichiers.push(nom); };   // même garde que la vraie fonction (essai à blanc)
  // espion : lignes réellement écrites dans le PDF / la feuille (après le tri)
  window.__lignes = [];
  const trier = trierLignesExport;
  trierLignesExport = (labels, lignes, tri) => { const r = trier(labels, lignes, tri); if (!exportCapture && !tri) window.__lignes.push({ labels, lignes: r }); return r; };
};

// 1. fonctions pures
{
  const p = await (await browser.newContext()).newPage();
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  eq(await p.evaluate(() => ['12/03/2026', '2026-03-12', '5 cc', '1 250 L', '—', '', 'n°00004', 'Campagne 2027'].map(v => valeurTriExport(v).k)), ['d', 'd', 'n', 'n', 'vide', 'vide', 't', 't'], 'nature des cases');
  eq(await p.evaluate(() => [natureColonneExport(['01/02/2026', '—']), natureColonneExport(['2', '10 cc']), natureColonneExport(['A', '2'])]), ['d', 'n', 't'], 'nature des colonnes');
  const tri = (vals, s) => p.evaluate(([vals, s]) => trierLignesExport(['X'], vals.map(v => [v]), { c1: 'X', s1: s }).map(r => r[0]), [vals, s]);
  eq(await tri(['10', '2', '—', '1'], 1), ['1', '2', '10', '—'], '1 → 9, vides en bas');
  eq(await tri(['10', '2', '—', '1'], -1), ['10', '2', '1', '—'], '9 → 1, vides toujours en bas');
  eq(await tri(['05/11/2026', '02/11/2026', '10/11/2026'], 1), ['02/11/2026', '05/11/2026', '10/11/2026'], 'dates : ancien → récent');
  eq(await tri(['n°10', 'n°2', 'n°1'], 1), ['n°1', 'n°2', 'n°10'], 'texte naturel : n°2 avant n°10');
  eq(await p.evaluate(() => trierLignesExport(['A', 'B'], [['x', '2'], ['y', '1'], ['x', '1']], { c1: 'A', s1: 1, c2: 'B', s2: 1 })), [['x', '1'], ['x', '2'], ['y', '1']], 'puis par');
  eq(await p.evaluate(() => trierLignesExport(['A'], [['b'], ['a']], { c1: 'Inconnue', s1: 1 })), [['b'], ['a']], 'colonne absente : ordre inchangé');
  await p.context().close();
}

for (const mobile of [true, false]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const T = mobile ? 'mobile' : 'PC';
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  const page = () => p.evaluate(() => { const e = document.querySelector('.tri-export'); return e ? { titre: e.querySelector('.te-titre').textContent, options: [...e.querySelectorAll('#te-c1 option')].map(o => o.textContent), sens: [...e.querySelectorAll('.te-sens .tab-btn')].map(b => b.textContent), apercu: e.querySelector('#te-apercu').textContent } : null; });

  // 2. Inventaire PDF : colonnes du PDF, tri décroissant, contenu inchangé
  await p.evaluate(() => { inventaireActifsTab = 'brebis'; render('inventaire-actifs'); });
  await p.click('#btn-export-inventaire-pdf');
  await p.waitForSelector('.tri-export');
  let pg = await page();
  check(/^Export PDF · /.test(pg.titre), T + ' : titre « Export PDF · … » : ' + pg.titre);
  eq(pg.options, ["Comme à l'écran", 'N° court', 'N° long', 'N° officiel'], T + ' : exactement les colonnes du PDF');
  eq(await p.evaluate(() => window.__fichiers.length), 0, T + ' : essai à blanc : rien enregistré');
  await p.selectOption('#te-c1', 'N° court');
  pg = await page();
  eq(pg.sens, ['1 → 9', '9 → 1'], T + ' : sens d\'une colonne de nombres');
  await p.click('.te-sens .tab-btn[data-s="-1"]');
  check(/^Aperçu.*603.*602.*601/.test((await page()).apercu), T + ' : aperçu dans l\'ordre choisi : ' + (await page()).apercu);
  await p.selectOption('#te-c2', 'N° long');
  await p.evaluate(() => { window.__lignes = []; });
  await p.click('#te-exporter');
  await p.waitForFunction(() => window.__fichiers.length === 1);
  check(await p.evaluate(() => !document.querySelector('.tri-export')), T + ' : page fermée');
  const ecrit = await p.evaluate(() => window.__lignes.find(t => t.labels.includes('N° court')));
  eq(ecrit.lignes.map(r => r[0]), ['603', '602', '601'], T + ' : PDF trié 9 → 1');
  await p.waitForFunction(() => triExportActif === null && !triExportEnCours, null, { timeout: 3000 });   // tri remis à zéro une fois le fichier enregistré
  // Comme à l'écran
  await p.click('#btn-export-inventaire-pdf'); await p.waitForSelector('.tri-export');
  await p.evaluate(() => { window.__lignes = []; });
  await p.click('#te-exporter'); await p.waitForFunction(() => window.__fichiers.length === 2);
  eq((await p.evaluate(() => window.__lignes.find(t => t.labels.includes('N° court')))).lignes.map(r => r[0]), ['601', '602', '603'], T + ' : « Comme à l\'écran » : ordre de l\'écran');
  // Annuler : rien
  await p.click('#btn-export-inventaire-pdf'); await p.waitForSelector('.tri-export');
  await p.click('#te-annuler');
  await p.waitForTimeout(200);
  check(await p.evaluate(() => window.__fichiers.length === 2 && !document.querySelector('.tri-export')), T + ' : Annuler : rien enregistré');

  // 3. Soins réalisés Excel : colonnes de la feuille, dates
  await p.evaluate(() => { carnetSoinsF = null; carnetOnglet = 'soins'; render('sanitaire'); });
  await p.click('#cs-export'); await p.waitForSelector('.tri-export');
  pg = await page();
  check(/^Export Excel · /.test(pg.titre) && pg.options.includes('Produit') && pg.options.includes('Date'), T + ' : Excel : colonnes de la feuille : ' + pg.options.join(' | '));
  await p.selectOption('#te-c1', 'Date');
  eq((await page()).sens, ['Ancien → récent', 'Récent → ancien'], T + ' : sens d\'une colonne de dates');
  await p.evaluate(() => { window.__lignes = []; });
  await p.click('#te-exporter'); await p.waitForFunction(() => window.__fichiers.length === 3);
  const feuille = await p.evaluate(() => window.__lignes.find(t => t.labels.includes('Date')));
  const iD = feuille.labels.indexOf('Date');
  eq(feuille.lignes.map(r => r[iD]), ['02-11-2026', '05-11-2026', '10-11-2026'].map(x => x), T + ' : Excel trié ancien → récent');

  // 4. export exclu (Registre) : direct, sans page
  await p.evaluate(() => { registreView = 'sanitaire'; render('registre'); });
  await p.click('#btn-export-registre-pdf');
  await p.waitForFunction(() => window.__fichiers.length === 4);
  check(await p.evaluate(() => !document.querySelector('.tri-export')), T + ' : Registre : export direct, sans page de tri');
  // 5. moins de 2 lignes : direct
  await p.evaluate(() => { DB.brebis = DB.brebis.slice(0, 1); inventaireActifsTab = 'brebis'; render('inventaire-actifs'); });
  await p.click('#btn-export-inventaire-pdf');
  await p.waitForFunction(() => window.__fichiers.length === 5);
  check(await p.evaluate(() => !document.querySelector('.tri-export')), T + ' : une seule ligne : export direct');
  // 6. tous les écrans qui exportent : la page de tri s'ouvre (colonnes du fichier) ou l'export part directement ; jamais d'erreur
  await p.evaluate(prep);
  await p.evaluate(() => { DB.exploitation.elevageBio = true; DB.brebis.forEach((b, i) => { b.controleLaitier = [{ controle: 1, quantite: 900 + i * 100, date: '2026-11-15', campagne: 2026 }]; }); });
  const ECRANS = [
    ['Contrôle laitier', "render('controle-laitier')", ['btn-cl-export-xlsx', 'btn-cl-export-pdf']],
    ['Brebis à régulariser', "bilanCampagneTab = 'incoherences'; render('bilan-campagne')", ['btn-export-regulariser-xlsx']],
    ['Bilan de lactation', "bilanCampagneTab = 'lactation'; render('bilan-campagne')", ['btn-export-bilan-lactation-xlsx', 'btn-export-bilan-lactation-pdf']],
    ['Inventaire', "inventaireActifsTab = 'brebis'; render('inventaire-actifs')", ['btn-export-inventaire-xlsx', 'btn-export-inventaire-pdf']],
    ['Sous délai', "sousDelaiOrigine = null; render('sous-delai')", ['btn-export-sous-delai-pdf']],
    ['Soins réalisés', "carnetSoinsF = null; carnetOnglet = 'soins'; render('sanitaire')", ['cs-export', 'cs-export-pdf']],
    ['Traitements 12 mois', "render('traitements-12-mois')", mobile ? [] : ['s12-export-xlsx', 's12-export-pdf']],
    ['Échographies', "render('echographies')", mobile ? ['em-export-xlsx', 'em-export-pdf'] : ['ep-export-xlsx', 'ep-export-pdf']],
    ['Tri des agnelles', "render('agnelles')", mobile ? ['tm-export-xlsx', 'tm-export-pdf'] : ['ta-export', 'ta-export-pdf']]
  ];
  const pages = [];
  for (const [nom, code, ids] of ECRANS) {
    await p.evaluate(c => { document.querySelectorAll('.tri-export').forEach(e => e.remove()); eval(c); }, code);
    await p.waitForTimeout(150);
    for (const id of ids) {
      const ok = await p.evaluate(id => { const b = document.getElementById(id); return !!b && !b.disabled && b.offsetParent !== null; }, id);
      if (!ok) continue;
      const avant = await p.evaluate(() => window.__fichiers.length);
      await p.click('#' + id);
      await p.waitForFunction(n => document.querySelector('.tri-export') || window.__fichiers.length > n, avant, { timeout: 8000 });
      const r = await p.evaluate(() => { const e = document.querySelector('.tri-export'); return e ? [...e.querySelectorAll('#te-c1 option')].map(o => o.textContent) : null; });
      if (r) {
        pages.push(nom + ' ' + id);
        check(r[0] === "Comme à l'écran" && r.length >= 2, T + ' · ' + nom + ' (' + id + ') : page de tri avec les colonnes du fichier : ' + r.join(' | '));
        const ap = await p.evaluate(() => [...document.querySelectorAll('#te-apercu div')].map(d => d.textContent.trim()));
        check(ap.length && !ap.every(x => x === '—'), T + ' · ' + nom + ' (' + id + ') : aperçu lisible (1re colonne remplie) : ' + ap.join(' / '));
        await p.click('#te-exporter');
        await p.waitForFunction(n => window.__fichiers.length > n, avant, { timeout: 8000 });
      }
      await p.waitForFunction(() => !triExportEnCours, null, { timeout: 12000 });
    }
  }
  console.log(T + ' : page de tri ouverte pour ' + pages.length + ' exports : ' + pages.join(', '));
  check(pages.length >= 8, T + ' : la page de tri s\'ouvre sur les écrans de listes');
  await ctx.close();
}
await browser.close();
console.log('OK test_tri_exports_page');
