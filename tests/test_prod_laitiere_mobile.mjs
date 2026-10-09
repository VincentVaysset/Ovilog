/* Refonte Production laitière, partie 2 : écran MOBILE « Production laitière » à deux onglets Tank / Qualité. Aucun montant en euros ; Tank (litrage du mois et de la campagne, 10 derniers relevés,
   relevé du jour avec saisie au clavier réel, case « Prélèvement qualité ce jour » qui crée un prélèvement SANS analyses, derniers relevés cliquables, fiche relevé modifier / supprimer avec
   confirmation et prélèvement conservé, « Voir tous les relevés », exports Tank PDF / Excel / Calendrier avec choix de campagne) ; Qualité (flèches de mois sur les mois à prélèvements, toutes
   campagnes, tableau Moyennes Mois / Campagne, prélèvements du mois avec Super A / « résultats à saisir », bandeau positif, nouveau prélèvement, rapport de campagne, lien Bilan économique).
   saveData REMPLACÉ ; jeu synthétique ; export réel en LECTURE SEULE. */
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
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.laitTank = [
    { date: '2025-09-30', quantite: 100 }, { date: '2025-10-01', quantite: 200 }, { date: '2025-12-04', quantite: 300 }, { date: '2025-12-05', quantite: 310 },
    { date: '2026-09-28', quantite: 80 }, { date: '2026-09-29', quantite: 85.5 }, { date: '2026-09-30', quantite: 90 }, { date: '2026-10-01', quantite: 500 }, { date: '2026-10-02', quantite: 510 }];
  const pr = (date, vol, extra) => Object.assign({ id: 'p' + date, date, volumeLait: vol, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: null, salmonelles: null, campagne: campagneAnneeDebutPourDate(date) }, extra);
  DB.prelevementsQualite = [
    pr('2025-09-30', 100, { tb: 60, tp: 50, cellules: 250000 }), pr('2025-12-05', 310, { tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif' }),
    pr('2026-09-30', 90, { tb: 90, tp: 70, cellules: 300000, floreTotale: 10000, coliformes: 30, butyriques: 50, salmonelles: 'positif' }), pr('2026-10-02', 510)];
  DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-09-30', dateFin: '2026-09-30', cause: 'salmonelles', litrageL: 1200, commentaire: 'test' }];
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  window.__saisies = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__saisies.push({ nom, mime, n: bytes.length }); };
  plOnglet = 'tank'; plMoisQualite = null; plTousReleves = false; plCampagneTous = null;
  render('qualite');
});
const ouvrirTank = () => page.evaluate(() => { plOnglet = 'tank'; plTousReleves = false; render('qualite'); });
const ouvrirQualite = () => page.evaluate(() => { plOnglet = 'qualite'; render('qualite'); });

// ================================================================ 1. onglets, aucun montant en euros
await jeu();
eq(await page.evaluate(() => [...document.querySelectorAll('#pl-onglets .tab-btn')].map(b => b.textContent + (b.classList.contains('active') ? '*' : ''))), ['Tank*', 'Qualité'], 'deux onglets, Tank ouvert');
check(!/€/.test(await $t('#app')) && !/[Pp]énalité/.test(await $t('#app')), 'Tank : aucun montant en euros, plus de bloc pénalités');
await page.click('#pl-onglets [data-onglet="qualite"]');
check(!/€/.test(await $t('#app')) && !/[Pp]énalités bactério/.test(await $t('#app')) && !(await page.evaluate(() => !!document.getElementById('qualite-penalites-card'))), 'Qualité : aucun montant en euros, plus de bloc Pénalités bactério');
check(await page.evaluate(() => !document.querySelector('#qualite-months, #qualite-campagne-tabs, .stat-card')), 'plus de pastilles de mois, d\'onglets Campagne N / N+1 ni de tuiles colorées');
console.log('OK 1 deux onglets Tank / Qualité ; aucun montant en euros ; pastilles, onglets Campagne et tuiles supprimés.');

// ================================================================ 2. Tank : tuiles, graphique, relevé du jour au clavier réel
await ouvrirTank();
eq([await $t('#pl-litres-mois'), await $t('#pl-litres-campagne')], ['1 010 L', '1 010 L'], 'octobre 2026 = 500 + 510 ; campagne 2026 = idem (campagne qui commence le 01/10/2026)');
check(await page.evaluate(() => document.querySelectorAll('#pl-barres > div').length) === 9, 'graphique des derniers relevés (9 relevés disponibles) : ' + await page.evaluate(() => document.querySelectorAll('#pl-barres > div').length));
check(!(await page.evaluate(() => !!document.getElementById('q-tb'))), 'aucun formulaire d\'analyses dans le Tank');
await page.focus('#f-lait-date'); await page.keyboard.type('10032026', { delay: 40 });
await page.click('#f-lait-qte'); await page.keyboard.type('412.5', { delay: 40 });
check(await page.evaluate(() => document.getElementById('f-lait-date').value + '|' + document.getElementById('f-lait-qte').value + '|' + document.activeElement.id) === '2026-10-03|412.5|f-lait-qte', 'date et litres tapés au clavier, focus conservé');
await page.click('#q-checkbox');
await page.click('#btn-save-lait'); await page.waitForTimeout(100);
const r2 = await page.evaluate(() => ({ r: DB.laitTank.find(l => l.date === '2026-10-03'), p: DB.prelevementsQualite.find(x => x.date === '2026-10-03') }));
eq(r2.r, { date: '2026-10-03', quantite: 412.5 }, 'relevé enregistré');
check(r2.p && r2.p.volumeLait === 412.5 && r2.p.tb === null && r2.p.tp === null && r2.p.cellules === null && r2.p.listeria === null && r2.p.campagne === 2026, 'la case crée un prélèvement SANS analyses, volume = relevé : ' + JSON.stringify(r2.p));
eq([await $t('#pl-litres-mois'), await $t('#pl-litres-campagne')], ['1 422,5 L', '1 422,5 L'], 'totaux mis à jour (décimale conservée)');
console.log('OK 2 Tank : litrage du mois / de la campagne, graphique, relevé du jour tapé au clavier, la case crée un prélèvement sans analyses.');

// ================================================================ 3. écrasement avec confirmation, note de doublon, case verrouillée si le prélèvement existe
await page.fill('#f-lait-date', '2026-10-03'); await page.dispatchEvent('#f-lait-date', 'input');
check(/existe déjà pour le 03-10-2026 \(412,5 L\)/.test(await $t('#lait-doublon-note')) && await page.evaluate(() => document.getElementById('q-checkbox').checked && document.getElementById('q-checkbox').disabled) && /Un prélèvement qualité existe déjà/.test(await $t('#q-doublon-note')), 'note de doublon ; case cochée et verrouillée (prélèvement existant)');
await page.fill('#f-lait-qte', '420'); confirms.length = 0; reponse = false; await page.click('#btn-save-lait');
check(confirms.length === 1 && /412,5 L\)\. Le remplacer par 420 L/.test(confirms[0]) && await page.evaluate(() => DB.laitTank.find(l => l.date === '2026-10-03').quantite) === 412.5, 'écrasement : confirmation, refus = rien');
reponse = true; await page.click('#btn-save-lait'); await page.waitForTimeout(100);
check(await page.evaluate(() => DB.laitTank.find(l => l.date === '2026-10-03').quantite === 420 && DB.prelevementsQualite.find(p => p.date === '2026-10-03').volumeLait === 420 && DB.prelevementsQualite.filter(p => p.date === '2026-10-03').length === 1), 'confirmé : relevé mis à jour, volume du prélèvement réaligné, pas de doublon');
console.log('OK 3 relevé existant : note, confirmation avant écrasement, volume du prélèvement réaligné, case verrouillée.');

// ================================================================ 4. derniers relevés cliquables, fiche relevé, suppression avec confirmation
eq(await page.evaluate(() => [...document.querySelectorAll('#pl-derniers-releves .btn-releve')].map(b => b.dataset.date)), ['2026-10-03', '2026-10-02', '2026-10-01', '2026-09-30'], 'les 4 derniers relevés, du plus récent');
check(/Analyse/.test(await page.evaluate(() => document.querySelector('.btn-releve[data-date="2026-10-03"]').textContent)) && /Analyse/.test(await page.evaluate(() => document.querySelector('.btn-releve[data-date="2026-09-30"]').textContent)), 'badge « Analyse » sur les jours de prélèvement');
await page.click('.btn-releve[data-date="2026-10-01"]');
check(/Relevé du 01-10-2026/.test(await $t('.sheet-card')), 'fiche du relevé');
await page.fill('#rs-litres', '505'); await page.click('#rs-save'); await page.waitForTimeout(100);
check(await page.evaluate(() => DB.laitTank.find(l => l.date === '2026-10-01').quantite) === 505 && !(await page.evaluate(() => !!document.querySelector('.sheet-card'))), 'fiche : litres modifiés');
// suppression d'un relevé qui a un prélèvement : conservé, indiqué dans la confirmation
await page.click('.btn-releve[data-date="2026-10-03"]');
confirms.length = 0; reponse = false; await page.click('#rs-del');
check(confirms.length === 1 && /Supprimer le relevé du 03-10-2026 \(420 L\)/.test(confirms[0]) && /prélèvement qualité : il est conservé/.test(confirms[0]) && await page.evaluate(() => DB.laitTank.some(l => l.date === '2026-10-03')), 'confirmation avec mention du prélèvement conservé ; refus = rien supprimé');
reponse = true; await page.click('#rs-del'); await page.waitForTimeout(100);
check(await page.evaluate(() => !DB.laitTank.some(l => l.date === '2026-10-03') && DB.prelevementsQualite.some(p => p.date === '2026-10-03')), 'relevé supprimé, prélèvement conservé');
console.log('OK 4 fiche relevé : modifier, supprimer avec confirmation (mention du prélèvement conservé), badge Analyse.');

// ================================================================ 5. Voir tous les relevés
await page.click('#pl-voir-tous');
check(await page.evaluate(() => document.querySelectorAll('#pl-tous-releves .btn-releve').length) === 2 && /Campagne 2027/.test(await $t('#pl-camp-tous option:checked')), 'tous les relevés de la campagne en cours (2027 : les 01/10 et 02/10 ; le 30/09 est dans la campagne précédente) : ' + await page.evaluate(() => document.querySelectorAll('#pl-tous-releves .btn-releve').length));
await page.selectOption('#pl-camp-tous', '2025');
eq(await page.evaluate(() => [...document.querySelectorAll('#pl-tous-releves .btn-releve')].map(b => b.dataset.date)), ['2026-09-30', '2026-09-29', '2026-09-28', '2025-12-05', '2025-12-04', '2025-10-01'], 'campagne 2026 : ses relevés (le 30/09/2025 est de la campagne 2025), du plus récent');
await page.click('#pl-retour-releves');
check(await page.evaluate(() => !!document.getElementById('pl-derniers-releves')), 'retour aux derniers relevés');
console.log('OK 5 « Voir tous les relevés » : par campagne, plus récent d\'abord, retour.');

// ================================================================ 6. exports depuis le Tank : choix de campagne
await page.evaluate(() => { window.__saisies.length = 0; });
await page.click('#btn-export-tank-pdf');
check(await page.evaluate(() => !!document.querySelector('.export-camp-opt')) && /Campagne 2027 \(en cours\)/.test(await $t('.export-camp-opt')), 'plusieurs campagnes avec relevés : petit choix, campagne en cours en premier');
await page.click('.export-camp-opt[data-c="2025"]'); await page.waitForTimeout(300);
await page.click('#btn-export-calendrier-pdf'); await page.click('.export-camp-opt[data-c="2026"]'); await page.waitForTimeout(300);
await page.click('#btn-export-tank-xlsx'); await page.click('#export-camp-annuler'); await page.waitForTimeout(200);
eq((await page.evaluate(() => window.__saisies.map(x => x.nom))).map(n => n.replace(/\d{4}-\d{2}-\d{2}(?=\.)/, 'DATE')), ['tank_campagne-2026_DATE.pdf', 'calendrier-tank_campagne-2027_DATE.pdf'], 'exports par campagne choisie ; Annuler = rien');
await page.evaluate(() => { DB.laitTank = DB.laitTank.filter(l => l.date >= '2026-10-01'); render('qualite'); window.__saisies.length = 0; });
await page.click('#btn-export-tank-xlsx'); await page.waitForTimeout(300);
eq((await page.evaluate(() => window.__saisies.map(x => x.nom))).map(n => n.replace(/\d{4}-\d{2}-\d{2}(?=\.)/, 'DATE')), ['tank_campagne-2027_DATE.xlsx'], 'une seule campagne avec relevés : export direct, sans choix');
console.log('OK 6 exports Tank (PDF, Excel, Calendrier) : choix de campagne s\'il y en a plusieurs, direct sinon.');

// ================================================================ 7. Qualité : flèches de mois, moyennes, prélèvements
await jeu(); await ouvrirQualite();
check(/Octobre 2026/.test(await $t('#pl-mois-titre')) && /1 prélèvement/.test(await $t('#pl-mois-titre').then(() => page.evaluate(() => document.querySelector('#pl-mois-titre').parentNode.textContent))), 'ouvre sur le dernier mois avec prélèvement : octobre 2026');
check(await page.evaluate(() => document.getElementById('pl-mois-suiv').disabled) && !(await page.evaluate(() => document.getElementById('pl-mois-prec').disabled)), 'flèche suivante inactive sur le dernier mois');
const visites = [];
for (let i = 0; i < 5; i++) { visites.push(await $t('#pl-mois-titre')); if (await page.evaluate(() => document.getElementById('pl-mois-prec').disabled)) break; await page.click('#pl-mois-prec'); }
eq(visites, ['Octobre 2026', 'Septembre 2026', 'Décembre 2025', 'Septembre 2025'], 'les flèches parcourent les mois à prélèvements, toutes campagnes');
check(await page.evaluate(() => document.getElementById('pl-mois-prec').disabled), 'flèche précédente inactive sur le premier mois');
await page.click('#pl-mois-suiv'); await page.click('#pl-mois-suiv');                  // Septembre 2026
check(/Septembre 2026/.test(await $t('#pl-mois-titre')), 'retour à septembre 2026');
const moy = await page.evaluate(() => [...document.querySelectorAll('#pl-moyennes .pl-moy')].map(r => [...r.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())));
eq(moy[0], ['Moyennes', 'Septembre', 'Campagne'], 'colonnes Mois / Campagne');
eq(moy[1], ['TB g/L', '90,00', '74,50'], 'TB : mois = 90 ; campagne 2026 = (70 × 310 + 90 × 90) ÷ 400 (le prélèvement du 30/09/2025 est de la campagne précédente)');
eq(moy[4], ['Cellules milliers/mL', '300', '350'], 'cellules en milliers/mL (moyenne simple de la campagne : 400 et 300)');
check(await page.evaluate(() => { const d = qualiteCampagneData(2025).total; return d.tb === 74.5 && d.cellules === 350000; }), 'Campagne = qualiteCampagneData');
const lg = await page.evaluate(() => [...document.querySelectorAll('.pl-prelev')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
check(lg.length === 1 && /30-09-2026\s*90 LPositif TB 90,00 · TP 70,00 · MSU 160,00 Cellules 300 · Flore 10 000 · Colif\. 30 · Butyr\. 50 Listéria — · Salmonelles Positif/.test(lg[0]) && !/Super A/.test(lg[0]), 'prélèvement : lignes, cellules en milliers, Salmonelles positif, pas de Super A (positif) : ' + lg[0]);
check(await page.evaluate(() => !!document.getElementById('qualite-banner')) && /Salmonelles \(30-09-2026\)/.test(await $t('#qualite-banner')), 'bandeau « résultat positif » en haut de l\'onglet');
await page.click('#pl-mois-suiv');                                                              // Octobre 2026
check(await page.evaluate(() => !document.getElementById('qualite-banner')) && /résultats à saisir/.test(await $t('#pl-prelevements')) && !/TB —/.test(await $t('#pl-prelevements')), 'prélèvement sans analyses : « résultats à saisir », pas de bandeau');
console.log('OK 7 Qualité : flèches de mois (toutes campagnes), tableau Moyennes Mois / Campagne, prélèvements avec Positif / « résultats à saisir », cellules en milliers/mL, bandeau positif.');

// ================================================================ 8. prélèvement cliquable, nouveau prélèvement, rapport, lien Bilan économique
await page.click('.pl-prelev');
check(await page.evaluate(() => !!document.querySelector('.sheet-card')), 'un clic sur un prélèvement ouvre sa fiche (analyses à saisir)');
await page.click('#qs-close'); 
await page.click('#btn-qualite-add'); check(await page.evaluate(() => !!document.querySelector('.sheet-card')), '+ Nouveau prélèvement ouvre la fiche'); await page.click('#qs-close');
await page.evaluate(() => { window.__saisies.length = 0; });
await page.click('#btn-rapport-qualite'); await page.waitForTimeout(400);
eq((await page.evaluate(() => window.__saisies.map(x => x.nom))).map(n => n.replace(/\d{4}-\d{2}-\d{2}(?=\.)/, 'DATE')), ['rapport-campagne_2027_DATE.pdf'], 'rapport de campagne de la campagne du mois affiché');
await page.click('#pl-lien-eco'); await page.waitForTimeout(100);
check(await page.evaluate(() => currentView === 'bilan-campagne' && bilanCampagneTab === 'economique' && bilanEconomiqueCampagneAffichee === 2026), 'lien vers le Bilan économique de la campagne affichée');
console.log('OK 8 fiche d\'un prélèvement, nouveau prélèvement, Rapport de campagne (PDF) de la campagne du mois, lien Bilan économique.');

// ================================================================ 9. pas de données : états vides ; aucune écriture hors actions
await page.evaluate(() => { DB = migrateData({}); saveData = function () {}; DB.campagneDebut = 2026; plOnglet = 'qualite'; plMoisQualite = null; render('qualite'); });
check(/Aucun prélèvement qualité enregistré/.test(await $t('#app')) && await page.evaluate(() => !!document.getElementById('btn-qualite-add')), 'Qualité sans donnée : message et bouton');
await page.evaluate(() => { plOnglet = 'tank'; render('qualite'); });
check(/0 L/.test(await $t('#pl-litres-campagne')) && /Aucun relevé/.test(await $t('#pl-derniers-releves')), 'Tank sans donnée');
console.log('OK 9 états vides.');

// ================================================================ 10. données réelles (lecture seule)
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await page.evaluate((json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB);
    plOnglet = 'tank'; plTousReleves = false; render('qualite');
    const tank = document.getElementById('pl-tank-resume').textContent.replace(/\s+/g, ' ');
    plOnglet = 'qualite'; plMoisQualite = null; render('qualite');
    const qual = document.getElementById('pl-moyennes').textContent.replace(/\s+/g, ' ');
    const mois = document.getElementById('pl-mois-titre').textContent, nbMois = moisAvecPrelevements().length;
    return { tank, qual, mois, nbMois, euro: /€/.test(document.getElementById('app').textContent), intact: JSON.stringify(DB) === avant && window.__saves === 0 };
  }, j);
  check(out.intact && !out.euro, 'données réelles : aucune écriture, aucun euro : ' + JSON.stringify(out).slice(0, 300));
  console.log('OK 10 données réelles (lecture seule) : Tank « ' + out.tank.slice(0, 80) + ' … » ; Qualité sur ' + out.mois + ' (' + out.nbMois + ' mois à prélèvements) « ' + out.qual.slice(0, 120) + ' … ».');
}
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ÉCRAN MOBILE « PRODUCTION LAITIÈRE » SONT PASSÉS');
