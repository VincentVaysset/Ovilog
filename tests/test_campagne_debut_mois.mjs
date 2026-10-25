/* Les mois de la production laitière suivent le début de campagne réglé (plus d'octobre à septembre écrit en dur) : Tank, Calendrier du tank,
   Qualité du lait, Bilan économique, Bilan de lactation (écran et PDF). 1) début au 1er octobre : grille identique à l'ancienne (oct. -> sept.) ;
   2) début au 1er août : août -> juillet, août et septembre présents, total = somme des mois, textes « août à juillet » ; 3) début au 15 août :
   13 mois, le premier et le dernier partiels, chaque relevé compté une seule fois et dans sa campagne. saveData REMPLACÉ ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.clock.setFixedTime(new Date('2027-03-10T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const jeu = (mois, jour) => page.evaluate(([mois, jour]) => {
  DB = migrateData({}); saveData = () => true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test', campagneMoisDebut: mois, campagneJourDebut: jour });
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; delete DB.campagneDateDebut; delete DB.campagneDateFin;
  // un relevé le 1er et le 20 de chaque mois, d'août 2026 à août 2027 (100 L puis 10 L) : 26 relevés
  DB.laitTank = [];
  for (let i = 0; i < 13; i++) { const d = new Date(2026, 7 + i, 1), ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); DB.laitTank.push({ date: ym + '-01', quantite: 100 }, { date: ym + '-20', quantite: 10 }); }
  DB.prelevementsQualite = [{ id: 'p1', date: '2026-08-21', volumeLait: 10, tb: 70, tp: 55, cellules: 300000, floreTotale: 20000, coliformes: 10, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif' }];
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
}, [mois, jour]);
const donnees = () => page.evaluate(() => {
  const t = tankCampagneData(2026), q = qualiteCampagneData(2026), e = ecoCampagneData(2026), l = bilanLactationPcData(2026), c = calendrierTankData(2026);
  const somme = t.mois.reduce((s, m) => s + (m.litres || 0), 0);
  return {
    grille: moisCampagne(2026).map(m => m.label), periode: periodeMoisCampagneLibelle(2026),
    tankTotal: t.total.litres, tankSomme: Math.round(somme * 10) / 10, production: productionTankCampagne(2026),
    calendrier: c.colonnes.map(x => x.libelleCourt), calTotal: c.totalLitres,
    qualite: q.mois.map(m => m.libelleCourt), qualitePrelev: q.mois.reduce((s, m) => s + m.nbPrelevements, 0),
    eco: e.mois.map(m => m.libelleCourt), ecoVolume: Math.round(e.mois.reduce((s, m) => s + m.volume, 0) * 10) / 10,
    lactation: l.mensuel.map(m => m.label), lactTotal: l.litrageTank
  };
});

// ================================================================ 1. début au 1er octobre : grille d'origine
await jeu(10, 1);
const oct = await donnees();
eq(oct.grille, ['Oct 26', 'Nov 26', 'Déc 26', 'Jan 27', 'Fév 27', 'Mar 27', 'Avr 27', 'Mai 27', 'Jun 27', 'Jul 27', 'Aoû 27', 'Sep 27'], '1er octobre : grille d\'origine (octobre 2026 -> septembre 2027)');
eq(oct.periode, 'octobre à septembre', '1er octobre : texte « octobre à septembre »');
eq([oct.tankTotal, oct.tankSomme, oct.production, oct.lactTotal, oct.ecoVolume], [1210, 1210, 1210, 1210, 1210], '1er octobre : octobre 2026 -> août 2027 = 11 mois x 110 L, total = somme des mois partout');
console.log('OK 1 début au 1er octobre : grille et totaux identiques à l\'ancienne grille.');

// ================================================================ 2. début au 1er août
await jeu(8, 1);
const aout = await donnees();
const grilleAout = ['Aoû 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Déc 26', 'Jan 27', 'Fév 27', 'Mar 27', 'Avr 27', 'Mai 27', 'Jun 27', 'Jul 27'];
eq(aout.grille, grilleAout, '1er août : août 2026 -> juillet 2027');
eq(aout.periode, 'août à juillet', '1er août : texte « août à juillet »');
eq([aout.tankTotal, aout.tankSomme, aout.production, aout.lactTotal, aout.ecoVolume], [1320, 1320, 1320, 1320, 1320], '1er août : total du tank = somme des mois (Tank, Bilan de lactation, Bilan économique)');
eq(aout.calendrier.slice(0, 2), ['Aoû 26', 'Sep 26'], 'Calendrier du tank : août et septembre présents, en tête');
eq([aout.calendrier.length, aout.calTotal], [12, 1320], 'Calendrier du tank : 12 mois, total 1 320 L');
eq([aout.qualite[0], aout.qualitePrelev, aout.eco[0], aout.lactation[0], aout.lactation.length], ['Aoû 26', 1, 'Aoû 26', 'Aoû', 12], 'Qualité, Bilan économique, Bilan de lactation : grille d\'août, prélèvement d\'août compté');
// textes à l'écran (PC) et dans le PDF du Bilan de lactation
const texteEcran = await page.evaluate(() => { bilanLactationCampagneAffichee = 2026; return bilanLactationDesktopHtml(); });
check(/Tank · août à juillet · en milliers de litres/.test(texteEcran) && !/octobre à septembre/.test(texteEcran), 'Bilan de lactation PC : « Tank · août à juillet »');
const pdf = await page.evaluate(() => { const u8 = buildBilanLactationPdfBytes(2026); let s = ''; for (const x of u8) s += String.fromCharCode(x); return s; });
check(!/octobre .{0,4}septembre/.test(pdf), 'PDF du Bilan de lactation : plus de « octobre à septembre »');
console.log('OK 2 début au 1er août : grille août -> juillet partout, total = somme des mois, textes « août à juillet ».');

// ================================================================ 3. début au 15 août : 13 mois, premier et dernier partiels
await jeu(8, 15);
const q15 = await donnees();
eq(q15.grille, ['Aoû 26', ...grilleAout.slice(1), 'Aoû 27'], '15 août : 13 mois (août 2026 partiel ... août 2027 partiel)');
// campagne du 15/08/2026 au 14/08/2027 : août 2026 = le 20 (10 L) ; sept. -> juil. = 11 x 110 ; août 2027 = le 1er (100 L) -> 1 320 L
eq([q15.tankTotal, q15.tankSomme, q15.production, q15.lactTotal, q15.ecoVolume], [1320, 1320, 1320, 1320, 1320], '15 août : chaque relevé compté une fois, dans sa campagne ; total = somme des mois');
const parties = await page.evaluate(() => { const t = tankCampagneData(2026); return [t.mois[0].litres, t.mois[12].litres]; });
eq(parties, [10, 100], '15 août : août 2026 ne compte que le 20, août 2027 que le 1er');
console.log('OK 3 début au 15 août : 13 mois, mois partiels sans double comptage.');

await browser.close();
console.log('OK test_campagne_debut_mois');
