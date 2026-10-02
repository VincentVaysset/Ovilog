/* Page PC « Bilan économique » : mêmes calculs que l'écran mobile (bilanCampagneQualite), décomposés par mois.
   Cohérences testées : montant avec qualité − montant hors qualité = grades + Super A − pénalités = gain ;
   prix moyen = montant / volume ; litrage = somme mensuelle du tank = litrage du bilan de lactation.
   Mois sans MSU signalés hors gain (jamais ajoutés d'office). Détail du mois cliquable, coefficient MSU modifiable
   (mêmes champs et gestionnaires que le mobile), rapport PDF, aucune écriture à l'affichage. Jeu synthétique. */
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
  window.jeu = () => {
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
    const bon = (date, extra) => Object.assign({ id: 'p' + date, date, volumeLait: 1000, tb: 70, tp: 55, cellules: 300000, coliformes: 50, floreTotale: 50000, butyriques: 1000, listeria: 'negatif', salmonelles: 'negatif' }, extra || {});
    DB.prelevementsQualite = [
      bon('2026-12-10'),                                           // décembre : 4 grades A, Super A, MSU 125
      bon('2027-01-10', { tb: 75, cellules: 700000 }),             // janvier : cellules C (−30,50 €/1000 L), pas de Super A, MSU 130
      bon('2027-03-10', { tb: null, tp: null })                    // mars : pas de MSU -> pas de prix, mais 4 grades A (Super A)
    ];
    DB.laitTank = [
      { id: 't1', date: '2026-12-15', quantite: 12000 }, { id: 't2', date: '2027-01-15', quantite: 20000 },
      { id: 't3', date: '2027-02-15', quantite: 5000 }, { id: 't4', date: '2027-03-15', quantite: 8000 }
    ];
    DB.penalitesBacterio = [{ id: 'pe1', dateDebut: '2027-01-10', litrageL: 1000, cause: 'autre' }];   // 200 €/1000 L × 1 = 200 €
    DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    DB.bilanLactationSaisie = [];
  };
  window.ouvrir = (c) => { bilanCampagneTab = 'economique'; bilanEconomiqueCampagneAffichee = c; bilanEconomiqueMoisAffiche = null; render('bilan-campagne'); };
});
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-economique .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.replace(/ /g, ' ').trim(), k.querySelector('.brd-kpi-s').textContent.replace(/ /g, ' ').trim()]])));
const proche = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6);

// ================================================================ 1. calculs : cohérence avec bilanCampagneQualite
await page.evaluate(() => { jeu(); ouvrir(2026); });
await page.waitForSelector('#pc-economique');
const d = await page.evaluate(() => {
  const x = bilanEconomiquePcData(2026), b = bilanCampagneQualite(2026), lact = bilanLactationIndicateurs(2026);
  return { x: JSON.parse(JSON.stringify(Object.assign({}, x, { mois: x.mois.map(m => Object.assign({}, m, { res: undefined })) }))), b, lactLitrage: lact.litrageTotal, prod: productionTankCampagne(2026) };
});
const x = d.x, b = d.b;
check(proche(x.montantHors, b.montantHorsQualite) && proche(x.montantAvec, b.montantAvecQualite) && proche(x.gain, b.gainQualite) && proche(x.prixMoyenHors, b.prixMoyenHorsQualite) && proche(x.prixMoyenAvec, b.prixMoyenAvecQualite), 'mêmes montants et prix moyens que bilanCampagneQualite : ' + JSON.stringify({ hors: x.montantHors, avec: x.montantAvec, gain: x.gain }) + ' / ' + JSON.stringify(b));
const C = x.composition;
check(proche(x.gain, C.grades + C.superA - C.penalites), 'gain = grades + Super A − pénalités : ' + x.gain + ' = ' + C.grades + ' + ' + C.superA + ' − ' + C.penalites);
check(proche(x.montantAvec - x.montantHors, x.gain), 'montant avec qualité − montant hors qualité = gain');
check(proche(x.prixMoyenAvec * x.volumeCompte / 1000, x.montantAvec) && proche(x.prixMoyenHors * x.volumeCompte / 1000, x.montantHors), 'prix moyen × volume = montant');
check(proche(C.grades, -30.5 * 20) && proche(C.superA, 70 * 12) && proche(C.penalites, 200) && proche(x.gain, -610 + 840 - 200), 'composition attendue : grades −610, Super A +840, pénalités 200, gain +30');
check(x.litrageTank === 45000 && x.mois.reduce((a, m) => a + m.volume, 0) === 45000 && d.prod === 45000 && d.lactLitrage === 45000, 'litrage = somme des 12 mois = tank = bilan de lactation (45 000 L)');
check(proche(x.horsGain.superA, 70 * 8) && x.horsGain.mois.join() === 'Mar 27' && b.montantSuperA === 70 * 20, 'mois sans MSU (mars) : Super A de 560 € hors gain, signalé ; le bilan mobile compte 1 400 € de Super A sur tous les mois');
console.log('OK 1 cohérences : montants et prix = bilanCampagneQualite ; gain +30 € = grades −610 + Super A +840 − pénalités 200 ; prix moyen × volume = montant ; litrage 45 000 L = tank = bilan de lactation ; mars (sans MSU) hors gain, signalé.');

// ================================================================ 2. page : indicateurs
const k = await kpis();
check(k['Lait total produit'][0] === '45 000 L', 'lait total 45 000 L : ' + JSON.stringify(k['Lait total produit']));
check(k['Gain lié à la qualité'][0] === '+30 €' && /\/1000 L/.test(k['Gain lié à la qualité'][1]), 'gain +30 € : ' + JSON.stringify(k['Gain lié à la qualité']));
check(/^1 [0-9 ]+,\d €$|^\d+,\d €$/.test(k['Prix moyen avec qualité'][0]) && k['Montant hors qualité'][0] === await page.evaluate(() => pcEuro(bilanEconomiquePcData(2026).montantHors, 0).replace(/ /g, ' ')), 'prix moyen et montant hors qualité formatés : ' + JSON.stringify(k));
check(await page.evaluate(() => !document.querySelector('.fiche-desktop-grid') && /Campagne 2027 · prix du lait/.test(document.querySelector('.brd-sub').textContent)), 'page pleine largeur, sous-titre');
// graphique : un total par mois en k€, somme (hors qualité + gain) = total du mois
const bars = await page.evaluate(() => [...document.querySelectorAll('#pc-economique .pc-bar > span')].map(s => s.textContent));
const attendu = await page.evaluate(() => bilanEconomiquePcData(2026).mois.map(m => m.total !== null && m.volume > 0 ? fmtDecimal(m.total / 1000, 1) : '0'));
check(bars.length === 12 && bars.join() === attendu.join(), 'montant par mois (k€) = totaux calculés : ' + bars.join(' | '));
const chips = await page.evaluate(() => [...document.querySelectorAll('#bilan-eco-mois .chip')].map(c => c.textContent + (c.classList.contains('chip-empty') ? '(vide)' : '') + (c.classList.contains('selected') ? '(sél)' : '')));
check(chips.join('|') === 'Oct 26(vide)|Nov 26(vide)|Déc 26(sél)|Jan 27|Fév 27(vide)|Mar 27|Avr 27(vide)|Mai 27(vide)|Jun 27(vide)|Jul 27(vide)|Aoû 27(vide)|Sep 27(vide)', 'mois : pointillé = pas de prélèvement, premier mois avec données sélectionné : ' + chips.join('|'));
console.log('OK 2 indicateurs (45 000 L, gain +30 €), montant par mois, mois en pointillé / sélectionné.');

// ================================================================ 3. détail du mois (clic sur un mois)
let det = await page.evaluate(() => document.getElementById('bilan-eco-prix-mois-card').textContent.replace(/ /g, ' ').replace(/\s+/g, ' '));
check(/Détail du mois : Déc 26/.test(det) && /MSU 125,0 × 12,0000/.test(det) && /1500,0 €\/1000 L/.test(det) && /Bonus Super A\s*Obtenu/.test(det) && /Prix avec qualité\s*1570,0 €\/1000 L/.test(det) && /Total du mois\s*18 840 €/.test(det), 'détail de décembre (125 × 12 = 1500 ; +70 ; 1570 × 12 = 18 840) : ' + det);
await page.click('#bilan-eco-mois .chip[data-mois="2027-01"]');
await page.waitForFunction(() => /Détail du mois : Jan 27/.test(document.getElementById('bilan-eco-prix-mois-card').textContent));
det = await page.evaluate(() => document.getElementById('bilan-eco-prix-mois-card').textContent.replace(/ /g, ' ').replace(/\s+/g, ' '));
check(/Cellules\s*C.*30,50 €\s*\/1000 L/.test(det) && /Non obtenu/.test(det) && /Pénalités bactério\s*déduites du total du mois\s*−200 €/.test(det), 'détail de janvier (cellules C, Super A non obtenu, pénalité −200 €) : ' + det);
const totalJanv = await page.evaluate(() => bilanEconomiquePcData(2026).mois[3].total);
check(proche(totalJanv, (130 * 12 - 30.5) * 20 - 200), 'total de janvier = (130 × 12 − 30,50) × 20 − 200 : ' + totalJanv);
// un clic sur un mois en pointillé ne fait rien
await page.click('#bilan-eco-mois .chip[data-mois="2027-02"]');
check(/Jan 27/.test(await page.evaluate(() => document.getElementById('bilan-eco-prix-mois-card').textContent)), 'mois sans prélèvement : non sélectionnable');
console.log('OK 3 détail du mois : décembre (Super A obtenu), janvier (cellules C, pénalité −200 €, total calculé à la main), mois en pointillé non cliquable.');

// ================================================================ 4. composition du gain
const comp = await page.evaluate(() => [...document.querySelectorAll('#pc-economique .card')].find(c => /Composition du gain/.test(c.textContent)).textContent.replace(/ /g, ' ').replace(/\s+/g, ' '));
check(/Grades bactério\s*−610 €/.test(comp) && /Super A\s*\+840 €/.test(comp) && /Pénalités\s*−200 €/.test(comp) && /Gain net\s*\+30 €/.test(comp) && /Mar 27 : mois sans prix calculable \(MSU absente\), non inclus dans le gain — Super A 560 €/.test(comp), 'composition : ' + comp);
console.log('OK 4 composition du gain : grades −610, Super A +840, pénalités −200, gain net +30 ; mars signalé hors gain avec son Super A de 560 €.');

// ================================================================ 5. coefficient MSU modifiable (mêmes champs que le mobile)
await page.click('#btn-prix-coef');
check(await page.evaluate(() => !document.getElementById('qualite-prix-coef-edit').classList.contains('hidden') && document.getElementById('prix-coef-input').value === '12'), 'formulaire du coefficient ouvert, valeur actuelle 12');
await page.fill('#prix-coef-input', '13');
await page.click('#btn-prix-coef-save');
await page.waitForFunction(() => document.getElementById('prix-coef-value').textContent === '13,0000');
const apres = await page.evaluate(() => ({ c: coefficientMsuPourCampagne(2026), gain: bilanEconomiquePcData(2026).gain, entrees: JSON.stringify(DB.parametresPrixLait.map(e => [e.campagne, e.coefficientMsu])) }));
check(apres.c === 13 && /\[2026,13\]/.test(apres.entrees) && /\[0,12\]/.test(apres.entrees), 'coefficient 13 enregistré pour cette campagne, entrée précédente intacte : ' + JSON.stringify(apres));
check(proche(apres.gain, 30), 'le gain qualité ne dépend pas du coefficient : ' + apres.gain);
console.log('OK 5 coefficient MSU : même formulaire, entrée propre à la campagne, campagnes précédentes intactes.');

// ================================================================ 6. campagne sans donnée, rapport PDF, aucune écriture à l'affichage
await page.selectOption('#bilan-eco-campagne-select', '2025');
await page.waitForFunction(() => /Campagne 2026 · prix du lait/.test(document.querySelector('.brd-sub').textContent));
const vide = await kpis();
check(vide['Lait total produit'][0] === '—' && vide['Gain lié à la qualité'][0] === '—' && vide['Prix moyen avec qualité'][0] === '—', 'campagne sans donnée : tirets : ' + JSON.stringify(vide));
check(/Aucun prélèvement qualité sur cette campagne/.test(await page.evaluate(() => document.getElementById('bilan-eco-prix-mois-card').textContent)) && /Aucune saisie tank/.test(await page.evaluate(() => document.getElementById('pc-economique').textContent)), 'messages de campagne vide');
await page.evaluate(() => { ouvrir(2026); window.__export = null; window.saveOrShareBinaryFile = async (nom, bytes, mime) => { window.__export = { nom, mime, n: bytes.length }; }; window.__saves = 0; });
await page.click('#btn-export-rapport-campagne-pdf');
await page.waitForFunction(() => window.__export);
const ex = await page.evaluate(() => window.__export);
check(/^rapport-campagne_2027_\d{4}-\d{2}-\d{2}\.pdf$/.test(ex.nom) && ex.mime === 'application/pdf' && ex.n > 500, 'rapport de campagne PDF : ' + JSON.stringify(ex));
check(await page.evaluate(() => window.__saves) === 0, 'aucune écriture pendant l\'affichage et l\'export');
console.log('OK 6 campagne sans donnée (tirets et messages), rapport de campagne PDF, 0 écriture.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « BILAN ÉCONOMIQUE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
