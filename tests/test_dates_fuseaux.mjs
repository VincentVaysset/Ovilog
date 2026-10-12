/* Dates : même résultat en UTC ET en Europe/Paris (un contexte navigateur par fuseau, horloge figée à 23 h 30 UTC = 01 h 30 le lendemain à Paris).
   1. « Aujourd'hui » = jour LOCAL (date par défaut des formulaires, écran « Sous délai d'attente »), jamais le jour UTC ;
   2. présence à la date de référence : une entrée (ou sortie) datée EXACTEMENT du jour de référence est comptée de la même façon partout ;
   3. rappel « Vide définitive à confirmer » = fin de campagne − 30 jours, sans décalage ;
   4. garde-fou : plus aucun new Date().toISOString().slice(0, 10) dans l'appli (jour UTC pris pour « aujourd'hui »).
   saveData est REMPLACÉ par un compteur. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
for (const tz of ['UTC', 'Europe/Paris']) {
  const attendu = tz === 'UTC' ? '2026-10-02' : '2026-10-03';
  const ctx = await browser.newContext({ timezoneId: tz, viewport: { width: 1300, height: 1000 } });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T23:30:00Z'));
  page.on('pageerror', e => { throw new Error('PAGEERROR (' + tz + '): ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
    const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
    const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;   // pas de date de bascule : date de référence construite en heure locale
    DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
    DB.produitsInfo = { Intramicine: { posologie: '8 cc', delaiAttente: 3 } };
    const A = fiche(eid(3, 1), { id: 'A', sanitaire: [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-29', quantiteCc: 8, intervenant: 'Éleveur' }] });   // fin de délai le 02/10
    const B = fiche(eid(3, 2), { id: 'B', mouvements: [{ type: 'Entrée', cause: 'Renouvellement', date: '2025-10-01' }] });                // entrée EXACTEMENT le 1er octobre 2025
    const C = fiche(eid(3, 3), { id: 'C', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', date: '2025-10-01' }] });   // sortie EXACTEMENT le 1er octobre 2025
    DB.brebis = [A, B, C]; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    const o = {};
    o.jour = jourAujourdhuiISO();
    currentSheepId = 'A'; editContext = null; render('add-mouvement'); o.dateMouvement = document.getElementById('f-date').value;
    o.sousDelai = sousDelaiBrebisRows().map(x => x.eid === A.eid);
    const ref = new Date(2025, 9, 1);
    o.entreeLeJourDeRef = estBrebisPresenteALaDate(B, ref);
    o.sortieLeJourDeRef = estBrebisPresenteALaDate(C, ref);
    o.effectif = effectifPresentADate(new Date(2025, 9, 1));
    const bil = bilanReproductionCampagne(2025);
    o.bilanPresentes = bil.population.presentes;
    o.entreesTardives = bil.horsBilan.entreesTardives;
    // une entrée datée du jour de référence DB.campagneDateDemarrage (date posée à la bascule) : même résultat
    DB.campagneDateDemarrage = '2026-09-29';
    const refBascule = campagneRefDate();
    o.refBasculeLocale = formatISOLocal(refBascule);
    o.entreeLeJourDeBascule = estBrebisPresenteALaDate(fiche(eid(3, 9), { mouvements: [{ type: 'Entrée', date: '2026-09-29' }] }), refBascule);
    o.anneeDeNaissanceSansDecalage = toDateOuNull('2025-01-01').getFullYear();
    // rappel « Vide définitive à confirmer » : fin de campagne − 30 jours
    DB.campagneDateDemarrage = null;
    const fin = campagneDateFinReelle(); fin.setDate(fin.getDate() - 30);
    const ev = evenementsCalendrierDerives().find(e => e.label === 'Vide définitive à confirmer');
    o.rappelAttendu = formatISOLocal(fin); o.rappel = ev && ev.date;
    return o;
  });
  check(r.jour === attendu, tz + ' : jourAujourdhuiISO = ' + r.jour + ' (attendu ' + attendu + ')');
  check(r.dateMouvement === attendu, tz + ' : date proposée pour un nouveau mouvement = ' + r.dateMouvement);
  check(JSON.stringify(r.sousDelai) === JSON.stringify(tz === 'UTC' ? [true] : []), tz + ' : « Sous délai d\'attente » (fin de délai le 02/10) : ' + JSON.stringify(r.sousDelai) + ' — le 03/10 à 01 h 30 l\'animal est libre, le 02/10 à 23 h 30 non');
  check(r.entreeLeJourDeRef === true && r.sortieLeJourDeRef === true, tz + ' : entrée et sortie datées du jour de référence comptées présentes : ' + [r.entreeLeJourDeRef, r.sortieLeJourDeRef]);
  check(r.effectif === 3, tz + ' : effectif présent au 1er octobre 2025 = 3 (A ; B entrée ce jour-là ; C sortie ce jour-là, encore comptée) : ' + r.effectif);
  check(r.bilanPresentes === 3 && r.entreesTardives === 0, tz + ' : population du bilan 2025 = 3, aucune entrée tardive : ' + JSON.stringify([r.bilanPresentes, r.entreesTardives]));
  check(r.refBasculeLocale === '2026-09-29' && r.entreeLeJourDeBascule === true, tz + ' : date de bascule 29/09 lue sans décalage : ' + JSON.stringify([r.refBasculeLocale, r.entreeLeJourDeBascule]));
  check(r.anneeDeNaissanceSansDecalage === 2025, tz + ' : 01/01/2025 reste en 2025');
  check(r.rappel === r.rappelAttendu, tz + ' : rappel « Vide définitive » = fin de campagne − 30 j : ' + r.rappel + ' / ' + r.rappelAttendu);
  check(await page.evaluate(() => window.__saves) === 0, tz + ' : rien écrit');
  console.log('OK (' + tz + ') : aujourd\'hui local (' + attendu + '), formulaire, Sous délai, présence au jour de référence, bilan, bascule, rappel.');
  await ctx.close();
}
// Garde-fou : aucun « aujourd'hui » pris en UTC
const ctx = await browser.newContext(); const page = await ctx.newPage();
const src = await (await page.request.get(URL_APP)).text();
const restes = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /new Date\(\)\.toISOString\(\)\.slice\(0, *10\)/.test(l) && !/^\s*(\/\*|\*|\/\/)/.test(l) && !/Ne JAMAIS utiliser/.test(l));
check(restes.length === 0, 'aucun new Date().toISOString().slice(0, 10) restant : ' + restes.map(([n]) => n).join(','));
console.log('OK garde-fou : aucun « aujourd\'hui » en UTC dans l\'appli.');
await browser.close();
console.log('\nTOUS LES TESTS DE DATES (UTC ET EUROPE/PARIS) SONT PASSÉS (jeu synthétique, saveData remplacé, aucune donnée réelle)');
