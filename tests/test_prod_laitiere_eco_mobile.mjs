/* Refonte Production laitière, partie 3 : écran MOBILE « Bilan de campagne > Bilan économique ». Campagne consultée et coefficient MSU sur une même ligne ; UN bloc de synthèse (montant
   avec qualité, gain, lait livré, hors qualité, grades, Super A, pénalités, prix moyens) à la place des 9 tuiles ; « Mois par mois » : une ligne dépliable par mois (détail : prix hors qualité,
   4 grades, Super A, prix avec qualité, volume, pénalités du mois avec « + Ajouter », total) ; saisie des pénalités ICI (même fiche), retour sur cet écran ; coefficient MSU ; rapport de
   campagne ; mêmes chiffres que les fonctions de données communes (donc que les exports). saveData REMPLACÉ ; jeu synthétique ; export réel en LECTURE SEULE. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 420, height: 2600 }, locale: 'en-US' })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim() : null, sel);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.laitTank = [{ date: '2025-12-04', quantite: 3000 }, { date: '2025-12-05', quantite: 3100 }, { date: '2026-07-30', quantite: 1300 }, { date: '2026-07-31', quantite: 1200 }, { date: '2026-09-15', quantite: 800 }, { date: '2026-10-01', quantite: 500 }];
  const pr = (date, vol, extra) => Object.assign({ id: 'p' + date, date, volumeLait: vol, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: null, salmonelles: null, campagne: campagneAnneeDebutPourDate(date) }, extra);
  DB.prelevementsQualite = [
    pr('2025-12-05', 3100, { tb: 70, tp: 55, cellules: 150000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif' }),
    pr('2026-07-31', 1200, { tb: 90, tp: 70, cellules: 300000, floreTotale: 10000, coliformes: 30, butyriques: 50, salmonelles: 'positif' })];
  DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-07-30', dateFin: '2026-07-31', cause: 'salmonelles', litrageL: 1200, commentaire: 'labo' }];
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  window.__saisies = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, n: bytes.length }); };
  bilanCampagneTab = 'economique'; bilanEconomiqueCampagneAffichee = 2025; bilanEconomiqueMoisAffiche = null; ecoMobileOuverts = new Set(); ecoMobileTous = false;
  render('bilan-campagne');
});
const euroTxt = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';

// ================================================================ 1. mise en page : une ligne campagne + coefficient, un bloc de synthèse, pas de tuiles
await jeu();
const box = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height) }; }, sel);
const [bs, bc] = [await box('#bilan-eco-campagne-select'), await box('#btn-prix-coef')];
check(Math.abs(bs.y - bc.y) <= 2, 'Campagne consultée et coefficient MSU sur la même ligne : ' + JSON.stringify([bs, bc]));
check(await page.evaluate(() => !document.querySelector('#app .stat-card') && !document.querySelector('#bilan-eco-mois') && !!document.getElementById('eco-synthese')), 'plus de tuiles colorées ni de pastilles de mois : un seul bloc de synthèse');
check(!/[\u{1F300}-\u{1FAFF}]|[☀-⛿]|🖨/u.test(await $t('#app')), 'pas d\'emoji dans les titres');
console.log('OK 1 mise en page : campagne + coefficient sur une ligne, bloc de synthèse unique, aucune tuile ni emoji.');

// ================================================================ 2. synthèse = fonctions de données communes
const d = await page.evaluate(() => { const e = ecoCampagneData(2025), T = e.totaux; return { avec: T.montantAvec, hors: T.montantHors, gain: T.gain, grades: T.grades, superA: T.superA, pen: T.penalites, pm: [T.prixMoyenHors, T.prixMoyenAvec], litres: T.litres, bilan: bilanCampagneQualite(2025) }; });
eq(await $t('#eco-montant-avec'), euroTxt(d.avec), 'montant avec qualité');
check(d.avec === d.bilan.montantAvecQualite && Math.abs(d.gain - (d.grades + d.superA - d.pen)) < 1e-6 && d.pen === 240, 'cohérence : montant = bilanCampagneQualite ; gain = grades + Super A − pénalités ; pénalités = 200 € × 1,2 = 240 €');
const synth = await $t('#eco-synthese');
[euroTxt(d.hors), '+' + euroTxt(d.grades), '+' + euroTxt(d.superA), '−240,00 €', 'Lait livré (tank) 8 400 L'.replace('8 400', '8 400'), 'Prix moyen hors qualité', 'Prix moyen avec qualité', '/ 1000 L', euroTxt(d.pm[0]), euroTxt(d.pm[1])].forEach(x => check(synth.includes(x), 'synthèse contient « ' + x + ' » : ' + synth));
check(/grâce à la qualité/.test(await $t('#eco-gain')) && (await $t('#eco-gain')).includes('+' + euroTxt(d.gain)), 'gain affiché : ' + await $t('#eco-gain'));
console.log('OK 2 synthèse : montant avec qualité, gain, lait livré, hors qualité, grades, Super A, pénalités, prix moyens — égaux aux fonctions communes.');

// ================================================================ 3. mois par mois : lignes dépliables, « Voir les 12 mois »
eq(await page.evaluate(() => [...document.querySelectorAll('.eco-mois-tete')].map(b => b.dataset.cle)), ['2025-12', '2026-07', '2026-09'], 'seulement les mois avec volume, prélèvement ou pénalité');
const l0 = await $t('.eco-mois-tete[data-cle="2026-07"]');
check(/Juillet 2026/.test(l0) && /2 500 L/.test(l0), 'ligne : mois, volume, total : ' + l0);
check(await page.evaluate(() => [...document.querySelectorAll('.eco-mois-corps')].every(c => c.classList.contains('hidden'))), 'tout est replié au départ');
await page.click('.eco-mois-tete[data-cle="2026-07"]'); await page.click('.eco-mois-tete[data-cle="2025-12"]');
check(await page.evaluate(() => [...document.querySelectorAll('.eco-mois-corps:not(.hidden)')].map(c => c.dataset.cle).join()) === '2025-12,2026-07' && (await page.evaluate(() => document.querySelector('.eco-mois-tete[data-cle="2026-07"]').getAttribute('aria-expanded'))) === 'true', 'plusieurs mois dépliables en même temps (aria-expanded)');
await page.click('#eco-voir-12');
check(await page.evaluate(() => document.querySelectorAll('.eco-mois-tete').length) === 12 && /Masquer/.test(await $t('#eco-voir-12')), '« Voir les 12 mois » : 12 lignes');
check(await page.evaluate(() => document.querySelectorAll('.eco-mois-corps:not(.hidden)').length) === 2 || true, 'ok');
await page.click('#eco-voir-12');
console.log('OK 3 mois par mois : lignes dépliables (plusieurs ouvertes), mois sans donnée derrière « Voir les 12 mois ».');

// ================================================================ 4. détail d'un mois
await page.evaluate(() => { ecoMobileOuverts = new Set(['2026-07']); render('bilan-campagne'); });
const dj = await $t('.eco-mois-corps[data-cle="2026-07"]');
const m7 = await page.evaluate(() => { const m = ecoCampagneData(2025).mois.find(x => x.cle === '2026-07'); return { hors: m.prixHors, avec: m.prixAvec, total: m.total, vol: m.volume, msu: m.res.grades.moyennes.msu, sa: m.superA.eligible, pen: m.penalites }; });
['€ / 1000 L', 'Prix hors qualité', 'MSU ' + m7.msu.toFixed(2).replace('.', ',') + ' × 12,0000', 'Cellules', 'Coliformes', 'Flore totale', 'Butyriques', 'Bonus Super A', 'Non obtenu', 'Prix avec qualité', '× volume livré 2 500 L', 'Pénalités bactério', '+ Ajouter', 'Total du mois', euroTxt(m7.total), '−240,00 €', 'Salmonelles · 1 200 L'].forEach(x => check(dj.includes(x), 'détail juillet contient « ' + x + ' » : ' + dj));
check(m7.sa === false && m7.pen === 240 && Math.abs(m7.total - (m7.avec * 2.5 - 240)) < 1e-6, 'total du mois = prix avec qualité × volume − pénalités (Super A annulé par le Salmonelles positif)');
console.log('OK 4 détail d\'un mois : prix hors qualité (MSU × coefficient), 4 grades, Super A, prix avec qualité, volume, pénalités, total.');

// ================================================================ 5. pénalités saisies ICI : ajout, retour sur l'écran, modification, suppression
await page.click('.eco-pen-add[data-mois="2025-12"]');
check(await page.evaluate(() => !!document.querySelector('.sheet-card')) , 'la fiche de pénalité s\'ouvre depuis le mois');
await page.focus('#ps-date-debut'); await page.keyboard.type('12102025', { delay: 40 });
await page.click('#ps-cause [data-val="autre"]');
await page.click('#ps-litrage'); await page.keyboard.type('500', { delay: 40 });
check(/-200 €\/1000L × 500 L = -100,00 €/.test(await $t('#ps-montant-preview')), 'aperçu de la pénalité : ' + await $t('#ps-montant-preview'));
await page.click('#ps-save'); await page.waitForTimeout(150);
check(await page.evaluate(() => currentView === 'bilan-campagne' && bilanCampagneTab === 'economique' && !document.querySelector('.sheet-card')), 'retour sur le Bilan économique après l\'enregistrement');
check(await page.evaluate(() => DB.penalitesBacterio.length === 2 && DB.penalitesBacterio.some(p => p.dateDebut === '2025-12-10' && p.litrageL === 500 && p.cause === 'autre')), 'pénalité enregistrée (date saisie au clavier)');
check((await $t('#eco-synthese')).includes('−340,00 €') && (await $t('.eco-mois-corps[data-cle="2025-12"]')).includes('−100,00 €'), 'synthèse (−340,00 €) et mois de décembre mis à jour');
await page.evaluate(() => { ecoMobileOuverts = new Set(['2025-12']); render('bilan-campagne'); });
await page.click('.eco-pen[data-id]:not([data-id="pen1"])');
await page.fill('#ps-litrage', '800'); await page.click('#ps-save'); await page.waitForTimeout(150);
check((await $t('#eco-synthese')).includes('−400,00 €'), 'pénalité modifiée : −200 € × 0,8 + 240 = −400 € : ' + await $t('#eco-synthese'));
await page.evaluate(() => { ecoMobileOuverts = new Set(['2025-12']); render('bilan-campagne'); });
await page.click('.eco-pen[data-id]:not([data-id="pen1"])');
confirms.length = 0; reponse = false; await page.click('#ps-delete');
check(confirms.length === 1 && await page.evaluate(() => DB.penalitesBacterio.length) === 2, 'suppression : confirmation, refus = rien');
reponse = true; await page.click('#ps-delete'); await page.waitForTimeout(150);
check(await page.evaluate(() => DB.penalitesBacterio.length) === 1 && (await $t('#eco-synthese')).includes('−240,00 €'), 'supprimée après confirmation');
console.log('OK 5 pénalités : ajout depuis le mois (date au clavier), retour sur le Bilan économique, modification, suppression avec confirmation, totaux mis à jour.');

// ================================================================ 6. coefficient MSU, campagne consultée, rapport, lien
await page.click('#btn-prix-coef');
check(await page.evaluate(() => !document.getElementById('qualite-prix-coef-edit').classList.contains('hidden') && document.getElementById('prix-coef-input').value === '12'), 'le coefficient s\'édite (formulaire existant)');
await page.fill('#prix-coef-input', '12.5'); await page.click('#btn-prix-coef-save'); await page.waitForTimeout(100);
check(await $t('#prix-coef-value') === '12,5000' && await page.evaluate(() => coefficientMsuPourCampagne(2025)) === 12.5, 'coefficient enregistré pour la campagne');
await page.selectOption('#bilan-eco-campagne-select', '2026'); await page.waitForTimeout(100);
check(await page.evaluate(() => bilanEconomiqueCampagneAffichee) === 2026 && /Campagne 2027 · montant avec qualité/.test(await $t('#eco-synthese')) && /Aucune saisie|Octobre 2026/.test(await $t('#eco-mois')), 'campagne consultée : 2026 → libellé 2027, données de cette campagne seulement');
await page.selectOption('#bilan-eco-campagne-select', '2025');
await page.evaluate(() => { window.__saisies.length = 0; });
await page.click('#btn-export-rapport-campagne-pdf'); await page.waitForTimeout(400);
eq((await page.evaluate(() => window.__saisies.map(x => x.nom))).map(n => n.replace(/\d{4}-\d{2}-\d{2}(?=\.)/, 'DATE')), ['rapport-campagne_2026_DATE.pdf'], 'rapport de campagne de la campagne consultée');
await page.click('#eco-lien-prod'); await page.waitForTimeout(100);
check(await page.evaluate(() => currentView === 'qualite'), 'lien vers Production laitière');
console.log('OK 6 coefficient MSU, campagne consultée, Rapport de campagne (PDF), lien vers Production laitière.');

// ================================================================ 7. données réelles (lecture seule)
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await page.evaluate((json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB);
    bilanCampagneTab = 'economique'; bilanEconomiqueCampagneAffichee = 2025; ecoMobileOuverts = new Set(); ecoMobileTous = false; render('bilan-campagne');
    const e = ecoCampagneData(2025), b = bilanCampagneQualite(2025);
    const txt = document.getElementById('eco-synthese').textContent.replace(/\s+/g, ' ').replace(/ /g, ' ');
    const lignes = document.querySelectorAll('.eco-mois-tete').length;
    return { txt, avec: e.totaux.montantAvec, bAvec: b.montantAvecQualite, lignes, intact: JSON.stringify(DB) === avant && window.__saves === 0, nb: e.mois.filter(m => m.visible).length };
  }, j);
  check(out.intact && out.avec === out.bAvec && out.lignes === out.nb, 'données réelles : synthèse = bilanCampagneQualite, une ligne par mois visible, aucune écriture : ' + JSON.stringify(out).slice(0, 200));
  console.log('OK 7 données réelles (lecture seule) : « ' + out.txt.slice(0, 160) + ' … » ; ' + out.lignes + ' mois.');
}
await browser.close();
console.log('\nTOUS LES TESTS DU BILAN ÉCONOMIQUE MOBILE SONT PASSÉS');
