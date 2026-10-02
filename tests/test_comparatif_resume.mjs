/* Comparaison « campagne 2027 vs 2026 » et affichage depuis un résumé de campagne (page PC + PDF complet).
   Résumé 2026 (internes N=2025) = bilan externe du 23/09 ; campagne 2027 (N=2026) = petit jeu vivant.
   Vérifie : écarts des KPI et du tableau comparatif, chiffres du résumé, mention de source, courbe /
   millésimes « non disponibles », adoptés 3/1/4, données vivantes prioritaires dès qu'il y a des mises bas,
   PDF cohérent, et RIEN d'écrit pendant l'affichage. Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0;
  const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
  const fiche = (n, o) => Object.assign({ id: 'f' + n, eid: '2500162999' + String(n).padStart(6, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  // campagne 2027 (interne 2026) : 10 mises bas (8 simples + 2 doubles) = 12 nés (6 F, 5 M, 1 mort-né), 1 adopté, + 2 vides
  const brebis = [];
  for (let i = 0; i < 10; i++) {
    const lambs = i < 2 ? [{ sexe: 'Femelle' }, { sexe: 'Mâle' }] : i === 2 ? [{ sexe: 'Mort-né' }] : [{ sexe: i % 2 ? 'Femelle' : 'Mâle' }];
    if (i === 3) lambs[0].adopte = true;
    brebis.push(fiche(i + 1, { agnelages: [{ date: '2027-01-' + String(10 + i), campagne: 2026, lambs }] }));
  }
  brebis.push(fiche(11), fiche(12));
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = brebis; DB.beliers = []; DB.agnelles = []; DB.lots = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  // résumé 2026 = bilan externe (mêmes fonctions que la saisie guidée)
  DB.resumesCampagne = { 2025: resumeDepuisSaisie(2025, RESUME_EXTERNE_2026.valeurs, RESUME_EXTERNE_2026.source) };
  window.__resumeAvant = JSON.stringify(DB.resumesCampagne);
  window.afficher = (N) => { bilanCampagneTab = 'reproduction'; bilanReproductionCampagneAffichee = N; render('bilan-campagne'); };
  window.lirePdf = (bytes) => {
    const s = new TextDecoder('windows-1252').decode(bytes);
    const textes = [...s.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replace(/\\(\d{3})/g, (_, o) => new TextDecoder('windows-1252').decode(Uint8Array.of(parseInt(o, 8)))).replace(/\\([()\\])/g, '$1'));
    return { textes, pages: parseInt((s.match(/\/Count (\d+)/) || [])[1], 10) };
  };
});

const lignes = (idx) => page.evaluate((idx) => [...document.querySelectorAll('.brd-t')[idx].querySelectorAll('tr')].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())), idx);
const txt = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' || '), sel);

// ================================================================ 1. campagne 2027 (vivante) vs 2026 (résumé)
await page.evaluate(() => afficher(2026));
await page.waitForSelector('.brd-t');
check(await page.evaluate(() => !document.getElementById('btn-saisie-resume')), 'campagne vivante avec mises bas : pas de mention « résumé », pas de bouton de remplacement');
const kpi = await txt('.brd-kpi, .brd-kpis > *');
check(/vs campagne 2026/.test(kpi), 'KPI : écarts « vs campagne 2026 » : ' + kpi);
check(/10/.test(kpi) && /−353/.test(kpi), 'KPI mises bas 10 et écart −353 (vs 363) : ' + kpi);
const comp = await lignes(1);
const ligne = (lib) => comp.find(r => r[0] === lib);
check(/Comparatif 2027 vs 2026/.test(await txt('.brd-ttl')), 'carte « Comparatif 2027 vs 2026 »');
check(comp[0].join('|') === 'Indicateur|Campagne 2027|Campagne 2026|Écart', 'en-têtes du comparatif : ' + comp[0]);
check(ligne('Mises bas').slice(1).join('|') === '10|363|−353', 'mises bas : ' + ligne('Mises bas'));
check(ligne('Agneaux nés').slice(1).join('|') === '12|427|−415', 'agneaux nés : ' + ligne('Agneaux nés'));
check(ligne('Prolificité').slice(1, 3).join('|') === '1,20|1,18' && /^\+0,02$/.test(ligne('Prolificité')[3]), 'prolificité 1,20 vs 1,18 : ' + ligne('Prolificité'));
check(ligne('Mortinatalité')[2] === '3,28 %' && ligne('Mortalité après naissance')[2] === '9,20 %' && ligne('Mortalité totale')[2] === '12,18 %', 'taux 2026 lus dans le résumé : ' + JSON.stringify(comp));
check(ligne('Agneaux adoptés').slice(1).join('|') === '1|4|−3', 'adoptés 1 vs 4 (3 + 1 du résumé) : ' + ligne('Agneaux adoptés'));
// couleurs : mortinatalité en hausse = mauvais, mortalité après naissance en baisse = bon
const coul = await page.evaluate(() => [...document.querySelectorAll('.brd-t')[1].querySelectorAll('tr')].reduce((o, r) => { o[r.cells[0].textContent] = r.cells[3].firstElementChild ? r.cells[3].firstElementChild.className : ''; return o; }, {}));
check(coul['Mortinatalité'] === 'brd-mauvais' && coul['Mortalité après naissance'] === 'brd-bon' && coul['Prolificité'] === 'brd-bon', 'couleurs des écarts : ' + JSON.stringify(coul));
console.log('OK 1 campagne 2027 (vivante) vs 2026 (résumé) : écarts KPI et tableau comparatif, adoptés, couleurs.');

// ================================================================ 2. affichage de la campagne 2026 depuis le résumé
await page.evaluate(() => afficher(2025));
await page.waitForSelector('#btn-saisie-resume');
const src = await txt('.brd-alert.info');
check(/Chiffres du résumé de la campagne 2026/.test(src) && /Bilan externe édité le 23\/09\/2026/.test(src) && /période source du 01-09-2025 au 01-09-2026/.test(src), 'mention de source : ' + src);
check(!/Aucune mise bas enregistrée/.test(src), 'pas de « aucune mise bas » quand le résumé existe');
check(/Remplacer le résumé/.test(await txt('#btn-saisie-resume')), 'bouton « Remplacer le résumé »');
const g = await lignes(0);
const gl = (lib) => g.find(r => r[0].startsWith(lib));
check(gl('Mises bas').slice(1).join('|').replace(/\s/g, '') .startsWith('296') || /296/.test(JSON.stringify(gl('Mises bas'))), 'mises bas 296 : ' + JSON.stringify(g));
const kpi2 = await txt('.brd-kpi, .brd-kpis > *');
check(/363/.test(kpi2) && /1,18/.test(kpi2) && /9,20 %|9,2 %/.test(kpi2), 'KPI 2026 : 363 / 1,18 / 9,2 % : ' + kpi2);
const html = await page.evaluate(() => document.querySelector('.brd').textContent.replace(/\s+/g, ' '));
check(/Courbe hebdomadaire non disponible/.test(html) && /Détail par millésime non disponible/.test(html), 'courbe et millésimes « non disponibles »');
check(!/Taux de réussite global/.test(html), 'pas de taux de réussite global pour une campagne terminée');
check(/Agneaux adoptés/.test(html), 'ligne « Agneaux adoptés » présente');
const adop = await page.evaluate(() => [...document.querySelectorAll('.brd-t')[0].querySelectorAll('tr')].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())).find(r => r[0] === 'Agneaux adoptés'));
check(adop && adop.slice(1).includes('3') && adop.slice(1).includes('1') && adop.slice(1).includes('4'), 'adoptés 3 / 1 / 4 : ' + adop);
check(!/allaitement artificiel/i.test(html), 'aucune ligne « allaitement artificiel »');
// comparatif de la campagne 2026 : la précédente (2025) n'a aucun chiffre
check(/Aucun chiffre pour la campagne 2025 : résumé de campagne non saisi/.test(html), 'comparatif 2026 vs 2025 : « résumé de campagne non saisi »');
console.log('OK 2 campagne 2026 lue dans son résumé : source, KPI 363 / 1,18 / 9,2 %, courbe et millésimes non disponibles, adoptés 3/1/4, aucun « allaitement artificiel ».');

// ================================================================ 3. données vivantes prioritaires dès qu'il y a des mises bas
await page.evaluate(() => { DB.brebis[0].agnelages.push({ date: '2026-02-10', campagne: 2025, lambs: [{ sexe: 'Mâle' }] }); afficher(2025); });
await page.waitForSelector('.brd-t');
check(await page.evaluate(() => !document.getElementById('btn-saisie-resume')) && /1 mise bas|^.*Mises bas/.test(await txt('.brd-kpi, .brd-kpis > *')), 'campagne 2026 avec une mise bas vivante : chiffres vivants, plus de mention de résumé');
await page.evaluate(() => { DB.brebis[0].agnelages.pop(); });
console.log('OK 3 données vivantes prioritaires sur le résumé dès qu\'il y a des mises bas.');

// ================================================================ 4. PDF complet
const pdf2027 = await page.evaluate(() => { const r = lirePdf(buildBilanCompletPdfBytes(2026)); return { t: r.textes.join(' | '), pages: r.pages }; });
check(/Comparatif 2027 vs 2026/.test(pdf2027.t) && /353/.test(pdf2027.t) && /427/.test(pdf2027.t) && /3,28/.test(pdf2027.t), 'PDF 2027 : comparatif avec les chiffres 2026 du résumé');
const pdf2026 = await page.evaluate(() => { const r = lirePdf(buildBilanCompletPdfBytes(2025)); return { t: r.textes.join(' | '), pages: r.pages }; });
check(/Chiffres du résumé de la campagne 2026/.test(pdf2026.t) && /Bilan externe/.test(pdf2026.t) && /363/.test(pdf2026.t) && /1,18/.test(pdf2026.t) && /12,18/.test(pdf2026.t), 'PDF 2026 : source du résumé et chiffres du bilan du 23/09');
check(/Non disponible pour cette campagne/.test(pdf2026.t) && /Agneaux adopt/.test(pdf2026.t), 'PDF 2026 : courbe / millésimes non disponibles, adoptés');
check(!/allaitement artificiel/i.test(pdf2026.t), 'PDF : aucun « allaitement artificiel »');
console.log('OK 4 PDF complet : comparatif 2027 vs 2026, PDF 2026 lu depuis le résumé (source, chiffres, non disponible, adoptés).');

// ================================================================ 5. rien d'écrit
check((await page.evaluate(() => window.__saves)) === 0, 'aucun saveData pendant l\'affichage et le PDF');
check((await page.evaluate(() => JSON.stringify(DB.resumesCampagne) === window.__resumeAvant)), 'le résumé n\'a pas bougé');
console.log('OK 5 aucune écriture (0 saveData), résumé intact.');
await browser.close();
console.log('\nTOUS LES TESTS DU COMPARATIF ET DE L\'AFFICHAGE DEPUIS LE RÉSUMÉ SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
