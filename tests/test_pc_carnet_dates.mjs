/* Carnet sanitaire PC : calculs de dates (jours entiers) et tableaux « En délai d'attente aujourd'hui » / « Derniers soins ».
   Règles : dernière administration = début + durée − 1 ; reprise du lait = dernière + délai lait + 1 ; vente dès le = dernière + délai
   viande + 1 ; délai 0 = « aucune attente » (pas de date) ; calculées à l'affichage, jamais stockées. Cohérence : « en délai
   d'attente » = soins dont une date de reprise est STRICTEMENT future (le jour de la reprise, l'animal est libre). Anciens soins
   affichés « — » sans erreur. saveData remplacé par un compteur. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1300 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

// ================================================================ 1. calculs purs
const c = await page.evaluate(() => {
  const k = (date, d, l, v) => calculerDatesSoin({ date, dureeJours: d, delaiLaitJours: l, delaiViandeJours: v });
  return {
    exemple: k('2026-09-20', 1, 3, 10),               // 20/09, durée 1, délai 3 → reprise 24/09
    multi: k('2026-09-20', 3, 3, 0),                  // durée 3 → dernière 22/09, reprise 26/09
    zero: k('2026-09-20', 1, 0, 0),
    mois: k('2026-09-29', 3, 2, 5),                   // dernière 01/10 → lait 04/10, viande 07/10
    annee: k('2026-12-30', 2, 3, 10),                 // dernière 31/12 → lait 04/01/2027, viande 11/01/2027
    fevrier2027: k('2027-02-25', 1, 3, 4),            // 2027 non bissextile : lait 01/03, viande 02/03
    fevrier2028: k('2028-02-25', 1, 3, 4),            // 2028 bissextile : lait 29/02, viande 01/03
    laitSeul: k('2026-09-20', 1, 3, undefined),
    sansDuree: k('2026-09-20', undefined, 3, 3),
    dureeZero: k('2026-09-20', 0, 3, 3),
    ancien: datesDuSoin({ type: 'Traitement', produit: 'X', date: '2026-09-20', quantiteCc: 8 }),
    jour: jourAujourdhuiISO()
  };
});
check(c.exemple.derniere === '2026-09-20' && c.exemple.repriseLait === '2026-09-24' && c.exemple.venteDes === '2026-10-01', '20/09 + durée 1 + délai 3 → reprise du lait 24/09 : ' + JSON.stringify(c.exemple));
check(c.multi.derniere === '2026-09-22' && c.multi.repriseLait === '2026-09-26' && c.multi.venteDes === null && c.multi.aucuneAttenteViande === true, 'durée de plusieurs jours, délai viande 0 : ' + JSON.stringify(c.multi));
check(c.zero.repriseLait === null && c.zero.venteDes === null && c.zero.aucuneAttenteLait && c.zero.aucuneAttenteViande && c.zero.derniere === '2026-09-20', 'délai 0 : aucune attente, pas de date');
check(c.mois.derniere === '2026-10-01' && c.mois.repriseLait === '2026-10-04' && c.mois.venteDes === '2026-10-07', 'changement de mois : ' + JSON.stringify(c.mois));
check(c.annee.derniere === '2026-12-31' && c.annee.repriseLait === '2027-01-04' && c.annee.venteDes === '2027-01-11', 'changement d\'année : ' + JSON.stringify(c.annee));
check(c.fevrier2027.repriseLait === '2027-03-01' && c.fevrier2027.venteDes === '2027-03-02', 'fin février (2027) : ' + JSON.stringify(c.fevrier2027));
check(c.fevrier2028.repriseLait === '2028-02-29' && c.fevrier2028.venteDes === '2028-03-01', 'fin février (2028 bissextile) : ' + JSON.stringify(c.fevrier2028));
check(c.laitSeul.repriseLait === '2026-09-24' && c.laitSeul.venteDes === null && c.laitSeul.viandeConnue === false && c.laitSeul.aucuneAttenteViande === false, 'délai viande inconnu : pas de date, pas « aucune attente »');
check(c.sansDuree.derniere === null && c.dureeZero.derniere === null && c.ancien.derniere === null && c.ancien.repriseLait === null && c.ancien.venteDes === null, 'durée manquante ou nulle, ancien soin : rien de calculé (« — »)');
check(c.jour === '2026-10-02', 'jour local : ' + c.jour);
console.log('OK 1 calculs : 20/09 + durée 1 + délai 3 → 24/09, durée multiple, délai 0, mois, année, fin février (2027 / 2028 bissextile), soin ancien « — ».');

// ================================================================ 2. « en délai » = reprise strictement future
const lim = await page.evaluate(() => {
  const soin = { type: 'Traitement', produit: 'P', date: '2026-09-20', dureeJours: 1, delaiLaitJours: 3, delaiViandeJours: 10 };
  return ['2026-09-23', '2026-09-24', '2026-09-30', '2026-10-01'].map(j => { const r = soinSousDelai(soin, j); return [j, r.lait, r.viande]; });
});
check(JSON.stringify(lim) === JSON.stringify([['2026-09-23', true, true], ['2026-09-24', false, true], ['2026-09-30', false, true], ['2026-10-01', false, false]]), 'le jour de la reprise l\'animal est libre : ' + JSON.stringify(lim));
console.log('OK 2 frontière : le jour de la reprise (24/09, 01/10) l\'animal est libre ; la veille il est encore sous délai.');

// ================================================================ 3. tableaux de la page
await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const soin = (o) => Object.assign({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, voie: 'Intramusculaire', intervenant: 'Éleveur', commentaire: '', dureeJours: 1, delaiLaitJours: 7, delaiViandeJours: 28 }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: [] }; DB.produitsInfo = {};
  DB.brebis = [
    fiche(eid(3, 1), { sanitaire: [soin()] }),                                                                                 // lait 08/10, viande 29/10 : en délai
    fiche(eid(3, 2), { sanitaire: [soin({ date: '2026-09-20', delaiViandeJours: 0, produit: 'Ivomec' })] }),                 // lait 28/09 passé, viande 0 : libre
    fiche(eid(3, 3), { sanitaire: [soin({ date: '2026-09-01', delaiLaitJours: 3, delaiViandeJours: 30, produit: 'Cefalex' })] }), // lait passé, viande 02/10+? : 01/09+30+1 = 02/10 : libre aujourd'hui (jour de la reprise)
    fiche(eid(3, 4), { sanitaire: [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Ancien', date: '2026-09-29', quantiteCc: 5, intervenant: 'Éleveur', delaiAttente: 9 }] }),   // ancien soin : sans durée ni délais
    fiche(eid(3, 5), { sanitaire: [soin({ date: '2026-09-28', delaiLaitJours: 5, delaiViandeJours: 0, produit: 'Finadyne' })] }),  // lait 04/10 : en délai (lait seul)
    fiche(eid(3, 6), { statut: 'vendue', sanitaire: [soin()] })                                                                  // inactive : ignorée
  ];
  // lot collectif de 3 brebis (un soin par animal, même collectifId)
  [1, 2, 5].forEach(i => DB.brebis[i - 1].sanitaire.push(soin({ date: '2026-10-02', produit: 'Bravoxin 10', delaiLaitJours: 0, delaiViandeJours: 0, collectif: true, collectifId: 'TC-x' })));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.E = eid; carnetSanitairePcEtat = null; carnetDernierLot = null; render('sanitaire');
  window.__avant = JSON.stringify(DB);
});
await page.waitForSelector('#cs-en-delai');
const dl = await page.evaluate(() => soinsEnDelaiCarnet().map(r => [numeroVisuel(r.animal.eid), r.soin.produit, r.libere, r.lait, r.viande]));
check(JSON.stringify(dl) === JSON.stringify([['00001', 'Intramicine', '2026-10-29', true, true], ['00005', 'Finadyne', '2026-10-04', true, false]]), 'soins en délai (règle habituelle : âge décroissant puis n° croissant) : seulement ceux dont une date de reprise est future : ' + JSON.stringify(dl));
// cohérence avec la pastille de l'écran 2 et avec delaiEnCoursAnimal
const coh = await page.evaluate(() => {
  const viaSoins = new Set(soinsEnDelaiCarnet().map(r => r.animal.eid));
  const viaAnimal = new Set(animauxEligiblesCarnet().filter(a => a.delai.lait || a.delai.viande).map(a => a.eid));
  return JSON.stringify([...viaSoins].sort()) === JSON.stringify([...viaAnimal].sort()) && viaSoins.size === 2;
});
check(coh, 'même ensemble d\'animaux que la pastille « délai en cours » de l\'écran 2');
const cellules = sel => page.evaluate(s => [...document.querySelectorAll(s + ' tr')].slice(1).map(r => [...r.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())), sel);
const trs = (await cellules('#cs-en-delai')).map(c => c.join(' | '));
const entetesDelai = await page.evaluate(() => [...document.querySelectorAll('#cs-en-delai th')].map(x => x.textContent).join('|'));
check(entetesDelai === 'N°|Produit|Soin du|Reprise du lait|Vente possible dès le|Reste', 'colonnes de la maquette : ' + entetesDelai);
check(trs.length === 2 && /^n°00001 Antenaise \| Intramicine \| 30-09-2026 \| le 08-10-2026 \| 29-10-2026 \| lait 6 j · viande 27 j$/.test(trs[0]) && /^n°00005 Antenaise \| Finadyne \| 28-09-2026 \| le 04-10-2026 \| aucune attente \| lait 2 j$/.test(trs[1]), 'tableau « En délai d\'attente aujourd\'hui » (maquette : Soin du, Reprise, Vente dès le, Reste) : ' + JSON.stringify(trs));
check(/2 animaux · 2 soins/.test(await page.evaluate(() => document.getElementById('cs-en-delai').textContent.replace(/\s+/g, ' '))), 'compte : 2 animaux · 2 soins');
// derniers soins
const entetesDer = await page.evaluate(() => [...document.querySelectorAll('#cs-derniers th')].map(x => x.textContent).join('|'));
check(entetesDer === 'N°|Type de soin|Produit|Date|Dose|Ordonnance|Fait par|Reprise lait|Viande dès le|Voie|Durée|Date de fin', 'colonnes de la maquette puis voie, durée, date de fin : ' + entetesDer);
const dr = (await cellules('#cs-derniers')).map(c => c.join(' | '));
check(/02-10-2026/.test(dr[0]) && /3 animaux/.test(dr[0]) && /Bravoxin 10/.test(dr[0]) && /aucune attente/.test(dr[0]), 'le lot collectif tient sur UNE ligne « 3 animaux » en tête : ' + dr[0]);
check(dr.length === 1 + 5 && !dr.some(t => /00006/.test(t)), 'un soin par ligne ensuite (5 : 4 individuels + 1 ancien… hors vendue) : ' + dr.length);
const ancien = dr.find(t => /Ancien/.test(t));
check(ancien && /5 cc/.test(ancien) && /29-09-2026/.test(ancien) && !/ 0 j/.test(ancien) && (ancien.match(/—/g) || []).length >= 4 && /^n°00004 \| Traitement · Antibiotique \| Ancien \| 29-09-2026 \| 5 cc \| — \| Éleveur \| — \| — \| — \| — \| —$/.test(ancien), 'soin ancien : affiché sans erreur, durée / fin / reprise / vente en « — » : ' + ancien);
const nouveau = dr.find(t => /Intramicine/.test(t) && /Intramusculaire/.test(t));
check(nouveau && /^n°00001 \| Traitement · Antibiotique \| Intramicine \| 30-09-2026 \| 8 cc \| — \| Éleveur \| 08-10-2026 \| 29-10-2026 \| Intramusculaire \| 1 j \| 30-09-2026$/.test(nouveau), 'soin récent : type, dose, ordonnance, fait par, reprise, vente, puis voie, durée, date de fin : ' + nouveau);
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'affichage seul : rien écrit, aucune date stockée');
check(await page.evaluate(() => !JSON.stringify(DB.brebis).includes('repriseLait') && !JSON.stringify(DB.brebis).includes('venteDes')), 'les dates calculées ne sont jamais stockées');
// cohérence du tableau avec les dates affichées à l'écran 1 : modification de la date du jour -> le soin libre disparaît
const apres = await page.evaluate(() => soinsEnDelaiCarnet('2026-10-04').map(r => numeroVisuel(r.animal.eid)).join());
check(apres === '00001', 'au 04/10 (reprise du 04/10 = libre) il ne reste que 00001 en délai : ' + apres);
console.log('OK 3 tableaux : en délai = reprise future (2 animaux / 2 soins, cohérent avec la pastille), lot regroupé, ancien soin « — », rien stocké ni écrit.');
await browser.close();
console.log('\nTOUS LES TESTS DES CALCULS DE DATES ET TABLEAUX DU CARNET SONT PASSÉS (jeu synthétique, saveData remplacé, aucune donnée réelle)');
