/* « Sous délai d'attente » (mobile et PC). Un soin sans attente réelle n'y apparaît jamais : délai 0 hors bio, délai 0 en bio sans
   « minimum 48 h » (vaccins exclus par défaut) ; en bio, délai 0 avec « minimum 48 h » = 2 jours. Une carte (mobile) / une ligne (PC, PDF) par
   brebis avec tous ses produits encore en délai, fin la plus tardive ; accueil, « Créer un lot » et Contrôle de lot comptent les mêmes brebis.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau, bio) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-27T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate((bio) => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation.elevageBio = bio;
    DB.produits = { vaccins: ['Vaccin X'], antibiotiques: ['Antibio A', 'Antibio Zero'], antiparasitaires: [], antiinflammatoires: ['Hepatocor'], autres: ['Selephorte'] };
    const info = (lait, viande) => ({ delaiAttente: lait, delaiLait: lait, delaiViande: viande });
    DB.produitsInfo = { 'Vaccin X': info(0, 0), 'Antibio A': info(3, 7), 'Antibio Zero': info(0, 0), Hepatocor: info(0, 0), Selephorte: info(0, 0) };
    const soin = (produit, date) => ({ type: 'Traitement', produit, date, dureeJours: 1 });
    const fiche = (n, sanitaire) => ({ id: 'b' + n, eid: '250000004569' + String(n).padStart(3, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire, notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [
      fiche(1, [soin('Hepatocor', '2026-10-27'), soin('Selephorte', '2026-10-27')]),        // délai 0 : jamais sous délai hors bio
      fiche(2, [soin('Antibio A', '2026-10-26'), soin('Hepatocor', '2026-10-27')]),          // un produit à 3 j (+ anti-inflammatoire à 0)
      fiche(3, [soin('Antibio A', '2026-10-20')]),                                            // fini (20 + 3 = 23 < 27)
      fiche(4, [soin('Vaccin X', '2026-10-27'), soin('Antibio Zero', '2026-10-27')])
    ];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  }, bio);
  return page;
}
const groupes = p => p.evaluate(() => sousDelaiParBrebis().map(g => [g.sheepId, g.soins.map(s => s.produit), g.finDelai]));

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  // ================================================================ 1. hors bio : délai 0 = jamais sous délai
  let p = await ouvrir(bureau, false);
  eq(await groupes(p), [['b2', ['Antibio A'], '2026-10-29']], nom + ' hors bio : seuls les soins avec une attente réelle (délai 0 exclu, délai fini exclu)');
  eq(await p.evaluate(() => [dashboardStatsData ? new Set(sousDelaiBrebisRows().map(r => r.sheepId)).size : null, sanitaireDateHtml(DB.brebis[0].sanitaire[0])]), [1, '27-10-2026'], nom + ' hors bio : compteur, fiche sans « délai jusqu\'au » pour un délai 0');
  await p.context().close();

  // ================================================================ 2. bio : minimum 48 h (antibio, anti-inflammatoire), vaccin exclu, « autres » à confirmer
  p = await ouvrir(bureau, true);
  eq(await groupes(p), [['b1', ['Hepatocor'], '2026-10-29'], ['b4', ['Antibio Zero'], '2026-10-29'], ['b2', ['Hepatocor', 'Antibio A'], '2026-11-01']],
    nom + ' bio : délai 0 + minimum 48 h = 2 j (anti-inflammatoire, antibiotique), vaccin exclu, « autres » à confirmer non appliqué, 3 j doublé à 6 j ; une entrée par brebis');
  await p.evaluate(() => render('sous-delai'));
  const ecran = await p.evaluate((bureau) => bureau
    ? { lignes: [...document.querySelectorAll('.table-desktop tbody tr')].map(tr => [...tr.children].map(td => td.textContent)), txt: document.getElementById('app').innerText }
    : { cartes: [...document.querySelectorAll('#sous-delai-cartes .carte-liste')].map(c => [c.querySelector('.carte-liste-nm').textContent, c.querySelector('.carte-liste-d').textContent, c.querySelectorAll('.sd-soin').length]), txt: document.getElementById('app').innerText }, bureau);
  if (bureau) eq(ecran.lignes, [['n°69001', 'Hepatocor — soin 27-10-2026 — fin 29-10-2026', '29-10-2026', '2'], ['n°69004', 'Antibio Zero — soin 27-10-2026 — fin 29-10-2026', '29-10-2026', '2'], ['n°69002', 'Hepatocor — soin 27-10-2026 — fin 29-10-2026 ; Antibio A — soin 26-10-2026 — fin 01-11-2026', '01-11-2026', '5']], nom + ' : une ligne par brebis, ses produits, fin la plus tardive');
  else eq(ecran.cartes, [['n°69001', 'Encore 2 j', 1], ['n°69004', 'Encore 2 j', 1], ['n°69002', 'Encore 5 j', 2]], nom + ' : une carte par brebis, une ligne par produit, jours restants avant la fin la plus tardive');
  check(/3 brebis sous délai d'attente/.test(ecran.txt), nom + ' : compteur en brebis');
  // PDF : mêmes lignes que l'écran
  const pdf = await p.evaluate(() => { let args = null; const orig = buildPdfTableCharte; buildPdfTableCharte = a => { args = a; return new Uint8Array(1); }; saveOrShareBinaryFile = () => {}; document.getElementById('btn-export-sous-delai-pdf').click(); buildPdfTableCharte = orig; return { col: args.columns.map(c => c.label), rows: args.rows, sub: args.subtitle }; });
  eq([pdf.col, pdf.rows.length, pdf.rows[2][1]], [['N°', 'Produits (soin, fin du délai)', 'Fin du délai', 'Jours restants'], 3, 'Hepatocor — soin 27-10-2026 — fin 29-10-2026 ; Antibio A — soin 26-10-2026 — fin 01-11-2026'], nom + ' : PDF = une ligne par brebis, comme l\'écran');
  check(/^3 brebis sous délai/.test(pdf.sub), nom + ' : sous-titre du PDF en brebis');
  eq(await p.evaluate(() => new Set(sousDelaiBrebisRows().map(r => r.sheepId)).size), 3, nom + ' : accueil et Contrôle de lot comptent les mêmes brebis');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « SOUS DÉLAI D\'ATTENTE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
