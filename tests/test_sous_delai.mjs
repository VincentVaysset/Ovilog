/* « Sous délai d'attente » (mobile et PC), par catégorie : onglets Brebis (délais LAIT et VIANDE : traite, vente réforme) | Agnelles | Agneaux | Béliers
   (délai VIANDE). Un soin sans attente réelle n'y apparaît jamais : délai 0 hors bio, délai 0 en bio sans « minimum 48 h » (vaccins exclus par défaut) ;
   en bio, délai 0 avec « minimum 48 h » = 2 jours, délai légal doublé. Une carte (mobile) / une ligne (PC, PDF) par animal avec tous ses produits
   (type de délai, soin, fin) et la fin la plus tardive. Accueil : brebis seulement (lait ou viande) ; Contrôle de lot (traite) : délai lait des brebis.
   Export PDF et « Créer un lot » suivent l'onglet. saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
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
    DB.produits = { vaccins: ['Vaccin X'], antibiotiques: ['Antibio A', 'Antibio Zero'], antiparasitaires: ['Vermi V'], antiinflammatoires: ['Hepatocor'], autres: ['Selephorte'] };
    const info = (lait, viande) => ({ delaiAttente: lait, delaiLait: lait, delaiViande: viande });
    DB.produitsInfo = { 'Vaccin X': info(0, 0), 'Antibio A': info(3, 0), 'Antibio Zero': info(0, 0), Hepatocor: info(0, 0), Selephorte: info(0, 0), 'Vermi V': info(0, 10) };
    const soin = (produit, date) => ({ type: 'Traitement', produit, date, dureeJours: 1 });
    const fiche = (n, sanitaire) => ({ id: 'b' + n, eid: '250000004569' + String(n).padStart(3, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire, notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    const agneau = (n, sanitaire) => ({ sexe: 'Mâle', adopte: false, eid: '250000004561' + String(n).padStart(3, '0'), sanitaire, mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-10-12' }] });
    DB.brebis = [
      fiche(1, [soin('Hepatocor', '2026-10-27'), soin('Selephorte', '2026-10-27')]),        // délais 0 : jamais sous délai hors bio
      fiche(2, [soin('Antibio A', '2026-10-26'), soin('Hepatocor', '2026-10-27')]),          // lait 3 j
      fiche(3, [soin('Antibio A', '2026-10-20')]),                                            // fini
      fiche(4, [soin('Vaccin X', '2026-10-27'), soin('Antibio Zero', '2026-10-27')]),
      fiche(5, [soin('Vermi V', '2026-10-25')]),                                              // viande seule (vente réforme) : 10 j
      fiche(6, [])
    ];
    DB.brebis[5].agnelages = [{ date: '2026-10-12', campagne: 2026, codeRepro: 'MN', lambs: [agneau(1, [soin('Vermi V', '2026-10-26')]), agneau(2, [soin('Antibio A', '2026-10-26')])] }];
    DB.agnelles = [{ id: 'ag1', eid: '250000004566001', statut: 'active', origine: 'née', sanitaire: [soin('Vermi V', '2026-10-20')], mouvements: [] }];
    DB.beliers = [{ id: 'be1', eid: '250000004568001', statut: 'actif', sanitaire: [soin('Vermi V', '2026-10-27'), soin('Antibio A', '2026-10-27')], mouvements: [] }];
    DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  }, bio);
  return page;
}
const groupes = (p, cat) => p.evaluate(c => sousDelaiParAnimal(c).map(g => [g.eid.slice(-5), g.soins.map(s => s.produit + '/' + s.type + '/' + s.finDelai), g.finDelai]), cat);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  // ================================================================ 1. hors bio : délai 0 jamais sous délai ; brebis lait + viande ; autres catégories viande
  let p = await ouvrir(bureau, false);
  eq(await groupes(p, 'brebis'), [['69002', ['Antibio A/lait/2026-10-29'], '2026-10-29'], ['69005', ['Vermi V/viande/2026-11-04'], '2026-11-04']], nom + ' hors bio, brebis : lait et viande (vente réforme), délai 0 et délai fini exclus');
  eq(await groupes(p, 'agnelles'), [['66001', ['Vermi V/viande/2026-10-30'], '2026-10-30']], nom + ' : agnelles, délai viande');
  eq(await groupes(p, 'agneaux'), [['61001', ['Vermi V/viande/2026-11-05'], '2026-11-05']], nom + ' : agneaux, délai viande (le délai lait d\'un agneau ne compte pas)');
  eq(await groupes(p, 'beliers'), [['68001', ['Vermi V/viande/2026-11-06'], '2026-11-06']], nom + ' : béliers, délai viande');
  eq(await p.evaluate(() => [nbBrebisSousDelai(), new Set(sousDelaiBrebisRows().map(r => r.sheepId)).size, sanitaireDateHtml(DB.brebis[0].sanitaire[0])]), [2, 1, '27-10-2026'],
    nom + ' : accueil = brebis (lait ou viande) ; Contrôle de lot = délai lait des brebis ; fiche sans « délai jusqu\'au » pour un délai 0');
  await p.context().close();

  // ================================================================ 2. bio : minimum 48 h (antibio, anti-inflammatoire), vaccin exclu, « autres » à confirmer ; délais doublés
  p = await ouvrir(bureau, true);
  eq(await groupes(p, 'brebis'), [
    ['69001', ['Hepatocor/lait/2026-10-29', 'Hepatocor/viande/2026-10-29'], '2026-10-29'],
    ['69004', ['Antibio Zero/lait/2026-10-29', 'Antibio Zero/viande/2026-10-29'], '2026-10-29'],
    ['69002', ['Antibio A/viande/2026-10-28', 'Hepatocor/lait/2026-10-29', 'Hepatocor/viande/2026-10-29', 'Antibio A/lait/2026-11-01'], '2026-11-01'],
    ['69005', ['Vermi V/lait/2026-10-27', 'Vermi V/viande/2026-11-14'], '2026-11-14']],
    nom + ' bio : délai 0 + minimum 48 h = 2 j (lait et viande), vaccin exclu, « autres » à confirmer non appliqué, délais doublés ; une entrée par brebis');
  await p.evaluate(() => { sousDelaiOnglet = 'brebis'; render('sous-delai'); });
  const ecran = await p.evaluate((bureau) => ({
    onglets: [...document.querySelectorAll('.sd-onglets .tab-btn')].map(b => b.textContent),
    lignes: bureau ? [...document.querySelectorAll('.table-desktop tbody tr')].map(tr => tr.children[0].textContent + '|' + tr.children[2].textContent) : [...document.querySelectorAll('#sous-delai-cartes .carte-liste')].map(c => c.querySelector('.carte-liste-nm').textContent + '|' + c.querySelectorAll('.sd-soin').length),
    txt: document.getElementById('app').innerText, scan: !!document.getElementById('btn-controle-lot-delai') }), bureau);
  eq(ecran.onglets, ['Brebis (4)', 'Agnelles (1)', 'Agneaux (2)', 'Béliers (1)'], nom + ' : onglets avec effectifs');
  eq(ecran.lignes, bureau ? ['n°69001|29-10-2026', 'n°69004|29-10-2026', 'n°69002|01-11-2026', 'n°69005|14-11-2026'] : ['n°69001|2', 'n°69004|2', 'n°69002|4', 'n°69005|2'], nom + ' : une ligne / une carte par brebis, une ligne par produit et type de délai');
  check(/4 brebis sous délai d'attente/.test(ecran.txt) && ecran.scan === !bureau, nom + ' : compteur de l\'onglet ; Contrôle de lot (scan) sur l\'onglet Brebis du mobile');
  // onglet Agneaux : écran, PDF et lot suivent l'onglet
  await p.click('.sd-onglets .tab-btn[data-tab="agneaux"]');
  const ag = await p.evaluate(() => ({ actif: document.querySelector('.sd-onglets .tab-btn.active').dataset.tab, txt: document.getElementById('app').innerText, scan: !!document.getElementById('btn-controle-lot-delai') }));
  check(ag.actif === 'agneaux' && /2 agneaux sous délai d'attente/.test(ag.txt) && /Délai viande/.test(ag.txt) && !ag.scan, nom + ' : onglet Agneaux (délai viande, pas de Contrôle de lot)');
  const pdf = await p.evaluate(() => { let a = null; const o = buildPdfTableCharte; buildPdfTableCharte = x => { a = x; return new Uint8Array(1); }; let fic = null; saveOrShareBinaryFile = n => { fic = n; }; document.getElementById('btn-export-sous-delai-pdf').click(); buildPdfTableCharte = o; return { titre: a.title, n: a.rows.length, ligne: a.rows[0][1], fic }; });
  eq([pdf.titre, pdf.n, pdf.ligne, /^sous-delai-attente_agneaux_/.test(pdf.fic)], ["Sous délai d'attente · Agneaux", 2, 'Antibio A — viande — soin 26-10-2026 — fin 28-10-2026', true], nom + ' : PDF de l\'onglet affiché, même texte que l\'écran');
  await p.evaluate(() => { sousDelaiOnglet = 'brebis'; });
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « SOUS DÉLAI D\'ATTENTE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
