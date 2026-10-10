/* Page PC « Bilan de lactation » : mêmes indicateurs que l'écran mobile (jamais recalculés à part), litrage et
   effectif par mois, valeurs modifiables (mêmes champs, même badge « Valeur corrigée » et « Recalculer »), comparaison
   avec la campagne précédente, indicateur et carte « mises bas sans contrôle laitier » (cohérents avec la règle et
   avec « brebis passées à la traite »), ratio calculé avec le résumé de campagne quand aucune mise bas n'est
   enregistrée (valeurs de la maquette : 108 178 L, 351, 308,2 L, 285,4 L, 96,7 %), exports. Mobile inchangé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
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
  const eid = (n) => '2500162999' + '6' + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const mb = (d, lambs) => ({ date: d, campagne: 2026, lambs });
  const L = (sexe, o) => Object.assign({ sexe }, o || {});
  const cl = (n) => ({ controle: n, quantite: 1.1, anomalie: null, date: '2027-01-20', campagne: 2026 });
  window.jeu = () => {
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.brebis = [
      fiche(eid(1), { agnelages: [mb('2026-11-05', [L('Mâle')])], controleLaitier: [cl(1), cl(2)] }),
      fiche(eid(2), { agnelages: [mb('2026-11-12', [L('Mâle', { statutFinal: 'vendu' })])], controleLaitier: [cl(1)] }),
      fiche(eid(3), { agnelages: [mb('2026-11-20', [L('Femelle', { statutFinal: 'vendu' })])] }),      // sans contrôle, attendue (signal fort)
      fiche(eid(4), { agnelages: [mb('2026-12-02', [L('Femelle')])] }),                                  // sans contrôle, pas encore attendue
      fiche(eid(5), { agnelages: [mb('2026-12-05', [L('Mâle')])] }),                                     // sans contrôle
      fiche(eid(6), { agnelages: [mb('2026-12-07', [L('Mâle')])] }),                                     // sans contrôle
      fiche(eid(7), { controleLaitier: [cl(1)] }),                                                       // traite sans mise bas
      fiche(eid(8), { statut: 'vendue', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', date: '2026-12-15' }] })
    ];
    DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.laitTank = [
      { id: 't1', date: '2026-12-10', quantite: 1200 }, { id: 't2', date: '2027-01-12', quantite: 3000 },
      { id: 't3', date: '2027-01-25', quantite: 2000 }, { id: 't4', date: '2027-03-05', quantite: 4800 }
    ];
    DB.bilanLactationSaisie = [];
    DB.resumesCampagne = {};
  };
  window.ouvrir = (c) => { bilanCampagneTab = 'lactation'; bilanLactationCampagneAffichee = c; render('bilan-campagne'); };
});
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-lactation .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.replace(/ /g, ' ').trim(), k.querySelector('.brd-kpi-s').textContent.replace(/ /g, ' ').trim()]])));

// ================================================================ 1. campagne 2027 : calculs vivants
await page.evaluate(() => { jeu(); ouvrir(2026); });
await page.waitForSelector('#pc-lactation');
check(await page.evaluate(() => !document.querySelector('.fiche-desktop-grid') && /du 01\/10\/2026 au 30\/09\/2027/.test(document.querySelector('.brd-sub').textContent)), 'titre et période');
let k = await kpis();
check(k['Litrage total'][0] === '11 000 L' && /tank/.test(k['Litrage total'][1]), 'litrage total 11 000 L : ' + JSON.stringify(k['Litrage total']));
check(k['Brebis passées à la traite'][0] === '3', 'brebis passées à la traite 3 : ' + JSON.stringify(k['Brebis passées à la traite']));
check(k['Litrage / brebis traite'][0] === '3666,7 L', 'litrage / brebis traite : ' + k['Litrage / brebis traite'][0]);
const mbCount = await page.evaluate(() => misesBasTroupeauCampagne(2026));
check(mbCount === 6 && k['Traites / brebis ayant mis bas'][0] === '50,0 %' && /3 sur 6/.test(k['Traites / brebis ayant mis bas'][1]), 'ratio 3 traites / 6 mises bas = 50,0 % : ' + JSON.stringify(k['Traites / brebis ayant mis bas']));
check(k['Mises bas sans contrôle laitier'][0] === '4' && /1 attendue à la traite/.test(k['Mises bas sans contrôle laitier'][1]), 'sans contrôle 4 (1 attendue) : ' + JSON.stringify(k['Mises bas sans contrôle laitier']));
console.log('OK 1 indicateurs de la campagne 2027 : 11 000 L, 3 traites, 6 mises bas, ratio 50,0 %, 4 mises bas sans contrôle laitier (1 attendue à la traite).');

// ---- graphiques : litrage par mois et effectif par mois
const g = await page.evaluate(() => {
  const cartes = [...document.querySelectorAll('#pc-lactation .card')];
  const lit = [...cartes.find(c => /Litrage par mois/.test(c.textContent)).querySelectorAll('.pc-bar > span')].map(s => s.textContent);
  const eff = [...cartes.find(c => /moyenne mensuelle/.test(c.textContent)).querySelectorAll('.pc-bar > span')].map(s => s.textContent);
  const d = bilanLactationPcData(2026);
  return { lit, eff, tank: d.litrageTank, moy: d.moyenneEffectifCalculee, moyOvilog: moyennePresenceMensuelleCampagne(2026), nMois: d.mensuel.length, lbls: [...document.querySelectorAll('#pc-lactation .pc-bar-lbls')].map(x => x.textContent) };
});
check(g.lit.join('|') === '0|0|1,2|5,0|0|4,8|0|0|0|0|0|0', 'litrage par mois (milliers de L) : ' + g.lit.join('|'));
check(g.nMois === 12 && g.tank === 11000, 'somme des 12 mois = litrage du tank : ' + g.tank);
check(g.moy === g.moyOvilog, 'moyenne mensuelle de l\'effectif = moyennePresenceMensuelleCampagne : ' + g.moy + ' / ' + g.moyOvilog);
check(g.eff.length === 12 && g.eff[0] === '8' && g.eff[2] === '8' && g.eff[3] === '7', 'effectif : 8 brebis jusqu\'à la vente (15/12), 7 ensuite : ' + g.eff.join(','));
console.log('OK 1b litrage par mois (somme = 11 000 L du tank) ; effectif par mois, moyenne ' + g.moy + ' = calcul de l\'appli.');

// ================================================================ 2. cohérence avec la règle « sans contrôle laitier »
const coh = await page.evaluate(() => {
  const r = brebisMiseBasSansControleLaitier(2026);
  const traites = new Set(registreEntriesFor('brebis').filter(e => (e.controleLaitier || []).some(c => c.campagne === 2026)).map(e => e.eid));
  const actives = DB.brebis.filter(b => (b.statut || 'active') === 'active' && agnelageDeCampagne(b, 2026));
  return { n: r.sansControle, inter: r.liste.filter(l => traites.has(l.eid)).length, partition: actives.every(b => r.liste.some(l => l.eid === b.eid) !== traites.has(b.eid)), carte: document.querySelectorAll('#carte-sans-controle-laitier .pc-li').length, titre: document.querySelector('#carte-sans-controle-laitier').textContent.replace(/\s+/g, ' ') };
});
check(coh.n === 4 && coh.inter === 0 && coh.partition, 'indicateur = règle ; aucune brebis à la fois traite et sans contrôle : ' + JSON.stringify(coh));
check(coh.carte === 3 && /Voir les 1 autres dans Brebis à régulariser/.test(coh.titre), 'carte : 3 premières brebis + lien vers les autres : ' + coh.titre);
const ligneCarte = await page.evaluate(() => [...document.querySelectorAll('#carte-sans-controle-laitier .pc-li')].map(l => [...l.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ')));
check(/n°00003 · mise bas le 20\/11 attendue à la traite/.test(ligneCarte[0]), 'signal fort en tête : ' + ligneCarte[0]);
await page.click('#btn-lact-voir-regulariser');
check(await page.evaluate(() => bilanCampagneTab === 'incoherences' && !!document.getElementById('pc-regulariser')), '« Voir ... dans Brebis à régulariser » ouvre l\'onglet');
const kReg = await page.evaluate(() => document.querySelectorAll('#pc-regulariser .pc-kpis .brd-kpi-v')[4].textContent);
check(kReg === '4', 'même nombre (4) dans Brebis à régulariser : ' + kReg);
console.log('OK 2 cohérence : indicateur = règle = Brebis à régulariser (4) ; passées à la traite et sans contrôle ne se recoupent pas ; carte de 3 lignes, signal fort en tête.');

// ================================================================ 3. valeurs modifiables (mêmes champs que le mobile)
await page.evaluate(() => ouvrir(2026));
await page.fill('#bilan-lactation-brebis-traite', '5');
await page.dispatchEvent('#bilan-lactation-brebis-traite', 'change');
await page.waitForSelector('#btn-reset-lactation-brebis-traite');
k = await kpis();
check(k['Brebis passées à la traite'][0] === '5' && /corrigée/.test(k['Brebis passées à la traite'][1]) && /Valeur corrigée/.test(await page.evaluate(() => document.getElementById('pc-lactation').textContent)), 'valeur corrigée : badge + indicateur : ' + JSON.stringify(k['Brebis passées à la traite']));
check(await page.evaluate(() => JSON.stringify(DB.bilanLactationSaisie) === '[{"campagne":2026,"brebisTraite":5}]'), 'seul le champ corrigé est enregistré');
await page.click('#btn-reset-lactation-brebis-traite');
await page.waitForFunction(() => !document.getElementById('btn-reset-lactation-brebis-traite'));
k = await kpis();
check(k['Brebis passées à la traite'][0] === '3', 'recalcul automatique : retour à 3 : ' + JSON.stringify(k['Brebis passées à la traite']));
// mobile : même saisie, mêmes valeurs
const mobileVal = await page.evaluate(() => { const ind = bilanLactationIndicateurs(2026); return [ind.litrageTotal, ind.brebisTraite, ind.misesBas, ind.ratioTraitesMisesBas]; });
check(JSON.stringify(mobileVal) === JSON.stringify([11000, 3, 6, 50]), 'mêmes valeurs que l\'écran mobile : ' + JSON.stringify(mobileVal));
console.log('OK 3 valeurs modifiables : badge « Valeur corrigée », « Recalculer » (même champ, mêmes gestionnaires), valeurs identiques à l\'écran mobile.');

// ================================================================ 4. valeurs de la maquette : campagne 2026 avec résumé de campagne
await page.evaluate(() => {
  jeu(); DB.brebis = []; DB.laitTank = [];
  DB.bilanLactationSaisie = [{ campagne: 2025, litrageTotal: 108178, brebisTraite: 351, brebisPresentes: 379 }];
  DB.resumesCampagne = { 2025: resumeDepuisSaisie(2025, RESUME_EXTERNE_2026.valeurs, RESUME_EXTERNE_2026.source) };
  ouvrir(2025);
});
k = await kpis();
check(k['Litrage total'][0] === '108 178 L' && k['Brebis passées à la traite'][0] === '351', 'litrage 108 178 L, 351 traites : ' + JSON.stringify(k));
check(k['Litrage / brebis traite'][0] === '308,2 L' && k['Litrage / brebis présente'][0] === '285,4 L', '308,2 L / brebis traite, 285,4 L / brebis présente : ' + k['Litrage / brebis traite'][0] + ' / ' + k['Litrage / brebis présente'][0]);
check(k['Traites / brebis ayant mis bas'][0] === '96,7 %' && /351 sur 363 \(mises bas du résumé de campagne\)/.test(k['Traites / brebis ayant mis bas'][1]), 'ratio 96,7 % = 351 / 363 du résumé : ' + JSON.stringify(k['Traites / brebis ayant mis bas']));
check(k['Mises bas sans contrôle laitier'][0] === '—', 'sans contrôle laitier : tiret (aucune donnée vivante) : ' + JSON.stringify(k['Mises bas sans contrôle laitier']));
const noteComp = await page.evaluate(() => [...document.querySelectorAll('#pc-lactation .card')].find(c => /Comparaison/.test(c.textContent)).textContent.replace(/\s+/g, ' '));
check(/Le ratio utilise les 363 mises bas du résumé de campagne 2026/.test(noteComp) && /Les écarts s'afficheront dès qu'une campagne précédente est saisie/.test(noteComp), 'note du comparatif : ' + noteComp);
const mobile2025 = await page.evaluate(() => { const ind = bilanLactationIndicateurs(2025); return [ind.misesBas, ind.ratioTraitesMisesBas]; });
check(JSON.stringify(mobile2025) === '[0,null]', 'mobile inchangé : sans résumé, 0 mise bas et ratio null : ' + JSON.stringify(mobile2025));
console.log('OK 4 valeurs de la maquette retrouvées : 108 178 L, 351 traites, 308,2 L, 285,4 L, ratio 96,7 % (351 / 363 du résumé) ; le mobile garde son calcul.');

// ================================================================ 5. comparaison avec la campagne précédente
await page.evaluate(() => { jeu(); DB.bilanLactationSaisie = [{ campagne: 2025, litrageTotal: 9000, brebisTraite: 4, brebisPresentes: 8 }]; DB.brebis[0].agnelages.push({ date: '2025-11-05', campagne: 2025, lambs: [{ sexe: 'Mâle' }] }); ouvrir(2026); });
const comp = await page.evaluate(() => [...[...document.querySelectorAll('#pc-lactation .card')].find(c => /Comparaison/.test(c.textContent)).querySelectorAll('tr')].map(r => [...r.cells].map(c => c.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim())));
check(comp[0].join('|') === 'Indicateur|2026|2027|Écart', 'en-têtes : ' + comp[0]);
check(comp[1].join('|') === 'Litrage total|9 000 L|11 000 L|+2 000 L' || comp[1].join('|') === 'Litrage total|9 000 L|11 000 L|+2 000', 'litrage 9 000 -> 11 000 : ' + comp[1]);
check(comp[2].slice(1, 3).join('|') === '4|3' && comp[2][3] === '−1', 'brebis traites 4 -> 3 : ' + comp[2]);
console.log('OK 5 comparaison avec la campagne précédente : litrage 9 000 -> 11 000 L (+2 000), brebis traites 4 -> 3 (−1).');

// ================================================================ 6. exports (valeurs du PC) et aucune écriture hors saisie
await page.evaluate(() => { jeu(); DB.brebis = []; DB.laitTank = []; DB.bilanLactationSaisie = [{ campagne: 2025, litrageTotal: 108178, brebisTraite: 351, brebisPresentes: 379 }]; DB.resumesCampagne = { 2025: resumeDepuisSaisie(2025, RESUME_EXTERNE_2026.valeurs, RESUME_EXTERNE_2026.source) }; ouvrir(2025);
  window.__export = null; window.buildXlsxWorkbook = async (sheets) => { window.__feuilles = sheets; return new Uint8Array([1]); };
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { window.__export = { nom, mime }; }; window.__saves = 0; });
await page.click('#btn-export-bilan-lactation-xlsx');
await page.waitForFunction(() => window.__export);
const rows = await page.evaluate(() => window.__feuilles[0].rows);
const ratio = rows.find(r => /Ratio traites/.test(r[0]));
check(ratio[1] === 96.7 && rows.find(r => /Brebis ayant mis bas/.test(r[0]))[1] === 363, 'export Excel depuis le PC : mêmes valeurs que l\'écran (363, 96,7) : ' + JSON.stringify(ratio));
check(await page.evaluate(() => window.__saves) === 0, 'aucun saveData pendant l\'affichage et l\'export');
console.log('OK 6 export Excel lancé depuis le PC = valeurs de l\'écran (363 mises bas, 96,7 %), 0 écriture.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « BILAN DE LACTATION » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
