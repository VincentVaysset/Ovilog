/* Refonte Paramètres, partie 2 : onglet / rubrique Campagne. « Campagne en cours » (nom, dates, bouton de changement -> écran de vérification, point de restauration conditionnel) ;
   « Date de démarrage de la campagne » en lecture + « Modifier » (avertissement et case de confirmation seulement à la modification) ; « Réglages de reproduction » (gestation, 1er retour,
   délai mise bas -> IA, UN seul Enregistrer, validation avant toute écriture, plus de case de confirmation) ; « Campagne actuelle » (année + OK) seulement sur une installation non
   initialisée ; plus de nettoyage ni de doublons ici (déplacés dans Sauvegarde > Maintenance, replié). Saisie au clavier. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const box = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }, sel);
const visible = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel);

for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 420, height: 1400 } })).newPage();
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  const alertes = [];
  page.on('dialog', d => { if (d.type() === 'alert') alertes.push(d.message()); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  const jeu = (init) => page.evaluate((initialisee) => {
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = initialisee; DB.campagneDateDemarrage = '2026-10-01';
    DB.exploitation = { ...DB.exploitation, nom: 'Galibert Clément', campagneMoisDebut: 10, campagneJourDebut: 1 };
    DB.reproGestationMin = 142; DB.reproGestationMax = 152; DB.reproRetourMin = 160; DB.reproRetourMax = 171; DB.reproSeuilMiseBasMois = 3;
    DB.agnelles = []; parametresTab = 'campagne'; parametresRubrique = 'campagne'; render('parametres');
  }, init);
  await jeu(true);
  // ---- structure
  const cEnCours = await box(page, '#card-campagne-en-cours'), cDate = await box(page, '#card-date-campagne'), cRepro = await box(page, '#card-repro');
  if (bureau) check(cEnCours.x === cDate.x && cEnCours.y < cDate.y && cRepro.x > cEnCours.x, 'PC : Campagne en cours et Date à gauche, Réglages de reproduction à droite');
  else check(cEnCours.x === cDate.x && cDate.x === cRepro.x && cEnCours.y < cDate.y && cDate.y < cRepro.y, 'mobile : une colonne Campagne en cours, Date, Réglages');
  eq(await page.evaluate(() => [...document.querySelectorAll('#parametres-tab-content .prm-titre')].map(e => e.textContent)), ['Campagne en cours', 'Date de démarrage de la campagne', 'Réglages de reproduction'], nom + ' : cartes de l\'onglet (installation initialisée)');
  check(await page.evaluate(() => !document.getElementById('app').textContent.includes('❔') && !document.getElementById('btn-nettoyer-registre') && !document.getElementById('btn-dd-analyser') && !document.getElementById('card-campagne-initiale')), nom + ' : ni ❔, ni nettoyage/doublons, ni carte « Campagne actuelle »');
  eq(await page.evaluate(() => document.querySelector('.prm-campagne-nom').textContent), 'Campagne 2027', nom + ' : nom de la campagne');
  check((await page.evaluate(() => document.getElementById('card-campagne-en-cours').textContent)).includes('du 1er octobre 2026 au 30 septembre 2027'), nom + ' : dates de la campagne');
  eq(await page.evaluate(() => document.getElementById('btn-nouvelle-campagne').textContent), 'Démarrer la campagne 2028', nom + ' : bouton de changement');
  check(!(await visible(page, '#btn-restaurer-pre-campagne')), nom + ' : pas de point de restauration sans bascule préalable');
  // ---- point de restauration conditionnel
  await page.evaluate(() => { window.__snap = { date: '2026-09-29T10:00:00Z', resume: '428 brebis' }; lireSnapshotPreCampagne = () => window.__snap; render('parametres'); });
  check(await visible(page, '#btn-restaurer-pre-campagne'), nom + ' : point de restauration affiché quand il existe');
  await page.evaluate(() => { window.__snap = null; render('parametres'); });
  // ---- bouton de changement : écran de vérification (comportement inchangé)
  await page.click('#btn-nouvelle-campagne');
  eq(await page.evaluate(() => currentView), 'confirmation-nouvelle-campagne', nom + ' : le bouton ouvre l\'écran de vérification');
  await page.evaluate(() => { render('parametres'); });
  // ---- date : lecture, Modifier, avertissement + case seulement à la modification
  eq(await page.evaluate(() => document.querySelector('#prm-date-lecture div').textContent), '1er octobre', nom + ' : date en lecture');
  check(!(await visible(page, '#f-exp-campagne-confirm')) && !(await visible(page, '.prm-avertissement')) && !(await visible(page, '#f-exp-campagne-mois')), nom + ' : avertissement, case et sélecteurs masqués au repos');
  await page.click('#btn-modifier-date-campagne');
  check(await visible(page, '.prm-avertissement') && await visible(page, '#f-exp-campagne-confirm') && await visible(page, '#f-exp-campagne-mois') && !(await visible(page, '#btn-modifier-date-campagne')), nom + ' : après « Modifier » : sélecteurs, avertissement et case');
  check(await page.evaluate(() => document.getElementById('btn-save-exp-campagne-date').disabled), nom + ' : Enregistrer désactivé tant que la case n\'est pas cochée');
  await page.selectOption('#f-exp-campagne-mois', '9');
  await page.check('#f-exp-campagne-confirm');
  check(await page.evaluate(() => !document.getElementById('btn-save-exp-campagne-date').disabled), nom + ' : Enregistrer actif une fois la case cochée');
  await page.click('#btn-annuler-date-campagne');
  check(await page.evaluate(() => DB.exploitation.campagneMoisDebut === 10 && window.__saves === 0), nom + ' : Annuler = rien d\'écrit');
  await page.click('#btn-modifier-date-campagne'); await page.selectOption('#f-exp-campagne-mois', '9'); await page.selectOption('#f-exp-campagne-jour', '15'); await page.check('#f-exp-campagne-confirm');
  await page.click('#btn-save-exp-campagne-date'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => [DB.exploitation.campagneMoisDebut, DB.exploitation.campagneJourDebut, window.__saves]), [9, 15, 1], nom + ' : date enregistrée une fois');
  await page.evaluate(() => { DB.exploitation.campagneMoisDebut = 10; DB.exploitation.campagneJourDebut = 1; window.__saves = 0; render('parametres'); });
  console.log('OK ' + nom + ' : structure, Campagne en cours, point de restauration conditionnel, bouton -> vérification, date en lecture + Modifier (avertissement et case à la modification).');

  // ---- réglages de reproduction : un seul Enregistrer, saisie au clavier, validation avant écriture
  check(await page.evaluate(() => document.querySelectorAll('#card-repro .btn-primary').length === 1 && !document.getElementById('f-repro-confirm') && /Rien de déjà enregistré n'est recalculé/.test(document.getElementById('card-repro').textContent)), nom + ' : un seul Enregistrer, plus de case de confirmation, mention « rien n\'est recalculé »');
  eq(await page.evaluate(() => ['f-repro-gestation-min', 'f-repro-gestation-max', 'f-repro-retour-min', 'f-repro-retour-max', 'f-repro-seuil-mb'].map(i => document.getElementById(i).value)), ['142', '152', '160', '171', '3'], nom + ' : valeurs actuelles affichées');
  await page.fill('#f-repro-gestation-min', ''); await page.click('#f-repro-gestation-min'); await page.keyboard.type('145', { delay: 30 });
  await page.fill('#f-repro-retour-max', ''); await page.click('#f-repro-retour-max'); await page.keyboard.type('150', { delay: 30 });   // 150 < min 160 : invalide
  await page.fill('#f-repro-seuil-mb', ''); await page.click('#f-repro-seuil-mb'); await page.keyboard.type('5', { delay: 30 });
  alertes.length = 0; await page.click('#btn-save-repro');
  check(alertes.length === 1 && /Fenêtres invalides/.test(alertes[0]) && await page.evaluate(() => DB.reproGestationMin === 142 && DB.reproSeuilMiseBasMois === 3 && window.__saves === 0), nom + ' : valeurs invalides = alerte et AUCUNE écriture (même pas le délai) : ' + alertes[0]);
  await page.fill('#f-repro-retour-max', ''); await page.click('#f-repro-retour-max'); await page.keyboard.type('175', { delay: 30 });
  alertes.length = 0; await page.click('#btn-save-repro'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => [DB.reproGestationMin, DB.reproGestationMax, DB.reproRetourMin, DB.reproRetourMax, DB.reproSeuilMiseBasMois, window.__saves]), [145, 152, 160, 175, 5, 1], nom + ' : les 5 réglages enregistrés d\'un coup');
  eq(await page.evaluate(() => ['f-repro-gestation-min', 'f-repro-retour-max', 'f-repro-seuil-mb'].map(i => document.getElementById(i).value)), ['145', '175', '5'], nom + ' : valeurs réaffichées');
  await page.fill('#f-repro-seuil-mb', '30'); alertes.length = 0; await page.click('#btn-save-repro');
  check(/entre 0 et 24/.test(alertes[0] || '') && await page.evaluate(() => DB.reproSeuilMiseBasMois === 5), nom + ' : délai hors 0-24 refusé');
  console.log('OK ' + nom + ' : réglages de reproduction (un seul Enregistrer, clavier, validation avant écriture, délai 0-24).');

  // ---- « Campagne actuelle » seulement sur une installation non initialisée
  await jeu(false);
  check(await page.evaluate(() => !!document.getElementById('card-campagne-initiale') && !document.getElementById('f-campagne-annee').disabled), nom + ' : installation non initialisée -> carte « Campagne actuelle » (année + OK) active');
  await page.fill('#f-campagne-annee', ''); await page.click('#f-campagne-annee'); await page.keyboard.type('2028', { delay: 30 }); await page.click('#btn-save-campagne-annee'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => DB.campagneDebut), 2027, nom + ' : année de fin 2028 -> campagneDebut 2027');
  console.log('OK ' + nom + ' : « Campagne actuelle » visible et fonctionnelle uniquement sur installation non initialisée.');

  // ---- nettoyage et doublons : dans Sauvegarde > Maintenance, replié par défaut
  await page.evaluate(() => { DB.campagneInitialisee = true; prmMaintenanceOuvert = false; parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; render('parametres'); });
  check(await page.evaluate(() => { const d = document.getElementById('prm-maintenance'); return !!d && !d.open && !!document.getElementById('btn-nettoyer-registre') && !!document.getElementById('btn-dd-analyser'); }), nom + ' : Maintenance repliée contient le nettoyage et les doublons');
  check(!(await visible(page, '#btn-nettoyer-registre')), nom + ' : contenu masqué tant que le bloc est replié');
  await page.click('#prm-maintenance > summary'); await page.waitForTimeout(150);
  check(await visible(page, '#btn-nettoyer-registre') && await page.evaluate(() => prmMaintenanceOuvert === true), nom + ' : dépliable, état mémorisé');
  console.log('OK ' + nom + ' : nettoyage + doublons dans Sauvegarde > Maintenance (replié, état mémorisé).');
  await page.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE PARAMÈTRES > CAMPAGNE SONT PASSÉS');
