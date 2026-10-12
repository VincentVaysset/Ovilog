/* Page PC « Brebis à régulariser » (écran PC simulé) : mêmes groupes et mêmes prédicats que l'écran mobile,
   indicateurs, barre d'avancement, listes avec n° et âge, recherche par n° saisi (pas de bip sur PC) et filtre par
   âge, « Voir les N autres », carte « sans contrôle laitier » (après l'import du 1er contrôle), incohérences
   signalées jamais corrigées, répartition par millésime, export Excel. Cohérence des chiffres avec l'écran mobile
   et avec la règle. Mobile inchangé (voir test_mobile_ecrans_reference). Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));   // horloge figée : les âges lus dans l'EID ne dépendent pas de l'année du jour
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0;
  const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
  // EID : 10 premiers chiffres fixes, 1 chiffre d'année (6 = 2026, 5 = 2025, 4 = 2024, ...), 5 chiffres de numéro
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const mb = (d, lambs) => ({ date: d, campagne: 2026, lambs });
  const L = (sexe, o) => Object.assign({ sexe }, o || {});
  const cl = (n) => ({ controle: n, quantite: 1.1, anomalie: null, date: '2027-01-20', campagne: 2026 });
  window.E = eid;
  window.jeu = (avecControle) => {
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const b = [];
    // 20 brebis à régulariser : 12 nées en 2019 (7 ans en 2026, EID chiffre 9 -> 2029-10 = 2019), etc. -> on varie les millésimes
    for (let i = 1; i <= 12; i++) b.push(fiche(eid(9, 100 + i)));   // chiffre 9 -> 2019
    for (let i = 1; i <= 6; i++) b.push(fiche(eid(3, 200 + i)));    // chiffre 3 -> 2023
    for (let i = 1; i <= 4; i++) b.push(fiche(eid(5, 300 + i)));    // chiffre 5 -> 2025
    // mises bas : 3, dont 1 avec contrôle, 1 attendue à la traite (agneaux tous vendus) sans contrôle, 1 non attendue
    b.push(fiche(eid(0, 400), { agnelages: [mb('2026-11-10', [L('Mâle', { statutFinal: 'vendu', mouvements: [{ type: 'Vendu', date: '2027-01-05' }] })])] }));
    b.push(fiche(eid(0, 401), { agnelages: [mb('2026-11-20', [L('Femelle')])] }));
    b.push(fiche(eid(0, 402), { agnelages: [mb('2026-12-01', [L('Mâle')])], controleLaitier: avecControle ? [cl(1)] : [] }));
    // 2 vides définitives
    b.push(fiche(eid(2, 500), { videesDefinitives: [{ date: '2026-12-05', campagne: 2026 }] }));
    b.push(fiche(eid(2, 501), { videesDefinitives: [{ date: '2026-12-06', campagne: 2026 }] }));
    // incohérence : mise bas ET vide définitive
    b.push(fiche(eid(1, 600), { agnelages: [mb('2026-12-10', [L('Mâle')])], videesDefinitives: [{ date: '2026-12-12', campagne: 2026 }] }));
    // une brebis vendue : pas comptée
    b.push(fiche(eid(1, 700), { statut: 'vendue' }));
    DB.brebis = b; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  };
  window.ouvrirPage = () => { bilanCampagneTab = 'incoherences'; render('bilan-campagne'); };
});

const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-regulariser .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));

// ================================================================ 1. page, indicateurs, listes
await page.evaluate(() => { jeu(false); ouvrirPage(); });
await page.waitForSelector('#pc-regulariser');
check(await page.evaluate(() => !document.querySelector('.fiche-desktop-grid') && document.querySelector('.brd-title').textContent === 'Brebis à régulariser'), 'page PC pleine largeur, titre');
check(/avant la clôture de la campagne 2027/.test(await page.evaluate(() => document.querySelector('.brd-sub').textContent)), 'sous-titre : campagne 2027');
let k = await kpis();
// actives : 12 + 6 + 4 (à régulariser) + 3 (mises bas) + 2 (vides) + 1 (incohérente : comptée parmi les mises bas) = 28
check(k['Brebis présentes'][0] === '28' && /actives en campagne/.test(k['Brebis présentes'][1]), 'brebis présentes 28 : ' + JSON.stringify(k));
check(k['À régulariser'][0] === '22' && k['À régulariser'][1] === '78,6 %', 'à régulariser 22 (78,6 %) : ' + JSON.stringify(k['À régulariser']));
check(k['Ont mis bas'][0] === '4' && k['Ont mis bas'][1] === '14,3 %', 'ont mis bas 4 (3 + l\'incohérente) : ' + JSON.stringify(k['Ont mis bas']));
check(k['Vides définitives'][0] === '2' && k['Vides définitives'][1] === '7,1 %', 'vides définitives 2 : ' + JSON.stringify(k['Vides définitives']));
check(k['Sans contrôle laitier'][0] === '—' && /dès le 1er contrôle/.test(k['Sans contrôle laitier'][1]), 'sans contrôle laitier : tiret avant le 1er contrôle : ' + JSON.stringify(k['Sans contrôle laitier']));
check(k['Incohérences'][0] === '1', 'incohérences 1 : ' + JSON.stringify(k['Incohérences']));
const avanc = await page.evaluate(() => document.querySelector('#pc-regulariser .card').textContent.replace(/\s+/g, ' '));
check(/6 brebis sur 28 ont une information de campagne/.test(avanc) && /Ont mis bas/.test(avanc) && /Vides définitives/.test(avanc), 'avancement : ' + avanc);
check(await page.evaluate(() => !document.getElementById('carte-sans-controle-laitier')), 'pas de carte « sans contrôle laitier » avant le 1er contrôle');
// carte incohérence en alerte, jamais corrigée
const inco = await page.evaluate(() => { const c = document.getElementById('pc-carte-incoherences'); return { texte: c.textContent.replace(/\s+/g, ' '), lignes: c.querySelectorAll('.pc-li').length }; });
check(/Contrôle des incohérences/.test(inco.texte) && inco.lignes === 1 && /Ovilog ne corrige jamais seul/.test(inco.texte), 'carte incohérences : ' + JSON.stringify(inco));
console.log('OK 1 indicateurs (28 présentes, 22 à régulariser, 4 ont mis bas, 2 vides, 1 incohérence), avancement, « sans contrôle laitier » = tiret avant le 1er contrôle.');

// liste « à régulariser » : 8 lignes visibles, n° + âge + « Ouvrir la fiche », triée du plus vieux au plus jeune
const liste = await page.evaluate(() => [...document.querySelectorAll('#pc-reg-liste .pc-li:not(.hidden)')].map(l => [...l.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ')));
check(liste.length === 8 && /^n°00101 .*7 ans Ouvrir la fiche$/.test(liste[0]) && /n°00108/.test(liste[7]), 'liste : 8 premières lignes, n° et âge, plus vieilles d\'abord : ' + JSON.stringify(liste));
check((await page.evaluate(() => document.getElementById('pc-reg-plus').textContent)) === 'Voir les 14 autres', '« Voir les 14 autres »');
await page.click('#pc-reg-plus');
check(await page.evaluate(() => document.querySelectorAll('#pc-reg-liste .pc-li:not(.hidden)').length) === 22 && await page.evaluate(() => document.getElementById('pc-reg-plus').style.display === 'none'), 'toutes les 22 lignes après « Voir les autres »');
// recherche par numéro saisi
await page.fill('#pc-reg-recherche', '00203');
let vis = await page.evaluate(() => [...document.querySelectorAll('#pc-reg-liste .pc-li:not(.hidden)')].map(l => l.dataset.num));
check(vis.join() === '00203', 'recherche 00203 : une seule ligne : ' + vis);
await page.fill('#pc-reg-recherche', '003');
vis = await page.evaluate(() => [...document.querySelectorAll('#pc-reg-liste .pc-li:not(.hidden)')].map(l => l.dataset.num));
check(vis.join() === '00301,00302,00303,00304', 'recherche 003 : les 4 brebis 003xx : ' + vis);
await page.fill('#pc-reg-recherche', '99999');
check(await page.evaluate(() => document.getElementById('pc-reg-aucune').style.display !== 'none' && document.querySelectorAll('#pc-reg-liste .pc-li:not(.hidden)').length === 0), 'recherche sans résultat : message');
await page.fill('#pc-reg-recherche', '');
// filtre par âge (7 ans = chiffre 9 -> 2019 ; en 2026 : 7 ans ; 2023 -> 3 ans ; 2025 -> 1 an)
await page.selectOption('#pc-reg-age', '7');
vis = await page.evaluate(() => [...document.querySelectorAll('#pc-reg-liste .pc-li:not(.hidden)')].length);
check(vis === 12, 'filtre 7 ans : 12 brebis : ' + vis);
const ageOpts = await page.evaluate(() => [...document.querySelectorAll('#pc-reg-age option')].map(o => o.textContent));
check(ageOpts.join('|') === 'Tous les âges|7 ans|3 ans|1 an', 'filtre d\'âge : ' + ageOpts);
await page.selectOption('#pc-reg-age', '');
console.log('OK 2 liste (8 lignes, n° + âge + Ouvrir la fiche), « Voir les 14 autres », recherche par n° saisi, filtre par âge, aucun résultat.');

// ================================================================ 3. cohérence avec l'écran mobile et la règle
const coh = await page.evaluate(() => {
  const d = bilanARegulariserData();
  const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active');
  const regul = actives.filter(estARegulariserCampagne).length;
  const mb = actives.filter(s => agnelageCampagneActuelleIdx(s) !== -1).length;
  const vd = actives.filter(s => agnelageCampagneActuelleIdx(s) === -1 && estVideDefinitiveCampagne(s)).length;
  // l'écran mobile : mêmes groupes (compteurs « N brebis »)
  const div = document.createElement('div'); div.innerHTML = bilanARegulariserMobileHtml();
  const mobile = [...div.querySelectorAll('.reg-pastille')].map(c => c.textContent.replace(/\s+/g, ' ')).join(' ');
  return { d: [d.groupes.aRegulariser.length, d.groupes.misesBas.length, d.groupes.videsDefinitives.length, d.actives], f: [regul, mb, vd, actives.length], mobile };
});
check(JSON.stringify(coh.d) === JSON.stringify(coh.f), 'groupes PC = prédicats de l\'appli : ' + JSON.stringify(coh));
check(/22 brebis/.test(coh.mobile) && /4 brebis/.test(coh.mobile) && /2 brebis/.test(coh.mobile), 'écran mobile : mêmes compteurs 22 / 4 / 2 : ' + coh.mobile.slice(0, 300));
const mill = await page.evaluate(() => bilanARegulariserData().parMillesime.map(m => m.annee + ':' + m.n).join(','));
const somme = await page.evaluate(() => bilanARegulariserData().parMillesime.reduce((a, m) => a + m.n, 0));
check(somme === 28, 'millésimes : la somme égale les brebis présentes (28) : ' + mill);
const barres = await page.evaluate(() => [...document.querySelectorAll('#pc-regulariser .pc-bar > span')].map(s => s.textContent).join(','));
check(barres === await page.evaluate(() => bilanARegulariserData().parMillesime.map(m => m.n).join(',')), 'histogramme = données : ' + barres);
console.log('OK 3 cohérence : groupes PC = prédicats de l\'appli = compteurs de l\'écran mobile ; millésimes (' + mill + ') = 28 brebis.');

// ================================================================ 4. après l'import du 1er contrôle laitier
await page.evaluate(() => { jeu(true); ouvrirPage(); });
k = await kpis();
check(k['Sans contrôle laitier'][0] === '3' && /1 attendue à la traite/.test(k['Sans contrôle laitier'][1]), 'sans contrôle laitier 3 (1 attendue à la traite) : ' + JSON.stringify(k['Sans contrôle laitier']));
const sc = await page.evaluate(() => [...document.querySelectorAll('#carte-sans-controle-laitier .pc-li')].map(l => [...l.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ')));
// brebis 00400 (agneaux tous vendus : attendue), 00401 (agneau non réglé), 00600 (incohérente, agneau non réglé) ; 00402 contrôlée : absente
check(sc.length === 3 && /n°00400\s*mise bas le 10\/11 · 1 agneau attendue à la traite/.test(sc[0]) && /n°00401\s*mise bas le 20\/11 · 1 agneau pas encore attendue \(1 agneau non réglé\)/.test(sc[1]) && !sc.some(t => /00402/.test(t)), 'carte sans contrôle : ' + JSON.stringify(sc));
const regle = await page.evaluate(() => brebisMiseBasSansControleLaitier(2026).sansControle);
check(regle === 3, 'cohérence avec la règle : 3');
// « Ouvrir la fiche » depuis la carte
await page.click('#carte-sans-controle-laitier .pc-li >> nth=0');
check(await page.evaluate(() => currentView === 'detail' && window.__saves === 0), 'fiche ouverte, 0 saveData');
console.log('OK 4 après le 1er contrôle : carte « sans contrôle laitier » (3 lignes, 1 attendue à la traite = signal fort), indicateur 3, brebis contrôlée absente, fiche ouverte sans écriture.');

// ================================================================ 5. export Excel
await page.evaluate(() => { jeu(true); ouvrirPage(); window.__export = null;
  window.buildXlsxWorkbook = async (sheets) => { window.__feuilles = sheets; return new Uint8Array([1, 2, 3]); };
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { window.__export = { nom, mime, n: bytes.length }; }; });
await page.click('#btn-export-regulariser-xlsx');
await page.waitForFunction(() => window.__export);
const ex = await page.evaluate(() => ({ e: window.__export, f: window.__feuilles }));
const rows = ex.f[0].rows;
check(/^brebis-a-regulariser_2027_\d{4}-\d{2}-\d{2}\.xlsx$/.test(ex.e.nom) && /spreadsheetml/.test(ex.e.mime), 'nom et type du fichier : ' + JSON.stringify(ex.e));
check(rows[0].join('|') === 'N°|Âge (ans)|Groupe|Détail' && rows.length === 1 + 22 + 4 + 2, 'export : en-tête + une ligne par brebis active (22 + 4 + 2) : ' + rows.length);
check(rows.filter(r => r[2] === 'À régulariser').length === 22 && rows.filter(r => /sans contrôle laitier/.test(r[3])).length === 3 && rows.filter(r => /incohérence/.test(r[3])).length === 1 && new Set(rows.slice(1).map(r => r[0])).size === 28, 'une ligne par brebis, signaux dans le détail');
check(rows.find(r => r[0] === '00400')[3] === 'sans contrôle laitier : mise bas le 10-11-2026 · attendue à la traite', 'détail de la brebis 00400 : ' + rows.find(r => r[0] === '00400'));
check(await page.evaluate(() => window.__saves) === 0, 'aucun saveData');
console.log('OK 5 export Excel : fichier daté, 28 lignes (une par brebis), détail « attendue à la traite », 0 écriture.');

// ================================================================ 6. cas limites
await page.evaluate(() => { DB.brebis = []; ouvrirPage(); });
check(/Aucune brebis active/.test(await page.evaluate(() => document.getElementById('pc-regulariser').textContent)), 'aucune brebis active : message');
await page.evaluate(() => { jeu(false); DB.campagneDebut = null; ouvrirPage(); });
check(/Aucune campagne définie/.test(await page.evaluate(() => document.getElementById('app').textContent)), 'aucune campagne définie : message');
console.log('OK 6 cas limites : aucune brebis active, aucune campagne définie.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « BREBIS À RÉGULARISER » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
