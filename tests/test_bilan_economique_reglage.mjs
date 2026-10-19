/* Réglage de COMPTE « Bilan économique » (bilanEconomiqueActif). Désactivé : l'onglet « Bilan économique » de Bilan de campagne (mobile et PC), le lien « Prix du lait, bonus et pénalités » de la
   Qualité du lait et la page économique du rapport PDF disparaissent ; la Qualité du lait (prélèvements, grades, Super A, exports) reste ; aucun montant en euros sur Qualité, Bilan de campagne et Accueil.
   Rien n'est supprimé : tank, prélèvements, pénalités et paramètres de prix reviennent tels quels à la réactivation (interrupteur dans Paramètres › Exploitation). Réglage ABSENT : actif seulement
   s'il y a déjà des données de lait ; un compte neuf reçoit explicitement « faux » (compteVideConfirme). Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
import { demarrerHarnais } from './lib/harnais_sync.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(pc) {
  const page = await (await browser.newContext({ viewport: pc ? { width: 1500, height: 1200 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.campagneDateDemarrage = '2026-10-01';
    DB.laitTank = [{ date: '2025-12-04', quantite: 300 }, { date: '2025-12-05', quantite: 310 }, { date: '2026-09-29', quantite: 85.5 }];
    const pr = (date, vol, extra) => Object.assign({ id: 'p' + date, date, volumeLait: vol, tb: null, tp: null, cellules: null, floreTotale: null, coliformes: null, butyriques: null, listeria: 'negatif', salmonelles: 'negatif' }, extra || {});
    DB.prelevementsQualite = [pr('2025-12-05', 310, { tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100 }), pr('2026-09-29', 90, { tb: 90, tp: 70, cellules: 300000, floreTotale: 10000, coliformes: 30, butyriques: 50 })];
    DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-09-29', dateFin: '2026-09-29', cause: 'salmonelles', litrageL: 1200, commentaire: 'test' }];
    DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }, { campagne: 2025, coefficientMsu: 12.5, prixReference: 1500, msuReference: 130 }];
    window.__donneesPrix = () => JSON.stringify([DB.laitTank, DB.prelevementsQualite, DB.penalitesBacterio, DB.parametresPrixLait]);
    window.__avantReglage = window.__donneesPrix();
  });
  return page;
}
const onglets = page => page.evaluate(() => [...document.querySelectorAll('#app .tab-bar:first-child .tab-btn')].map(b => b.textContent.trim()));
const texte = page => page.evaluate(() => document.getElementById('app').innerText);
const ouvrirBilan = (page, tab) => page.evaluate(t => { bilanCampagneTab = t || 'incoherences'; render('bilan-campagne'); }, tab);
const ouvrirQualite = page => page.evaluate(() => { plOnglet = 'qualite'; plMoisQualite = null; render('qualite'); });
const rapport = async page => lirePdfMots(await page.evaluate(() => Array.from(buildRapportCampagnePdfBytes(2026))));

// ================= 1. la règle de dérivation (réglage absent / explicite)
{
  const page = await ouvrir(false);
  const r = await page.evaluate(() => {
    const vide = migrateData({});
    const avecLait = migrateData({}); avecLait.laitTank = [{ date: '2026-01-01', quantite: 1 }];
    const avecPenalite = migrateData({}); avecPenalite.penalitesBacterio = [{ id: 'x', dateDebut: '2026-01-01' }];
    const faux = migrateData({}); faux.laitTank = [{ date: '2026-01-01', quantite: 1 }]; faux.bilanEconomiqueActif = false;
    const vrai = migrateData({}); vrai.bilanEconomiqueActif = true;
    return { cleAbsente: vide.bilanEconomiqueActif === undefined, vide: bilanEconomiqueActif(vide), avecLait: bilanEconomiqueActif(avecLait), avecPenalite: bilanEconomiqueActif(avecPenalite), faux: bilanEconomiqueActif(faux), vrai: bilanEconomiqueActif(vrai) };
  });
  eq(r, { cleAbsente: true, vide: false, avecLait: true, avecPenalite: true, faux: false, vrai: true }, 'réglage absent : actif seulement avec des données de lait ; un réglage explicite l\'emporte ; migrateData ne l\'invente pas');
  console.log('OK 1 règle : absent = déduit des données de lait, explicite = prioritaire.');
  await page.context().close();
}

// ================= 2. désactivé : mobile puis PC
for (const pc of [false, true]) {
  const nom = pc ? 'PC' : 'MOBILE';
  const page = await ouvrir(pc);
  await page.evaluate(() => { DB.bilanEconomiqueActif = false; });
  // Bilan de campagne : 3 onglets, jamais l'économique, même avec un état mémorisé
  await ouvrirBilan(page, 'economique');
  eq(await onglets(page), pc ? ['Brebis à régulariser', 'Bilan de reproduction', 'Bilan de lactation'] : ['À régulariser', 'Reproduction', 'Lactation'], nom + ' : onglets sans « Économique »');
  eq(await page.evaluate(() => bilanCampagneTab), 'incoherences', nom + ' : un onglet économique mémorisé retombe sur « Brebis à régulariser »');
  if (!pc) check(await page.evaluate(() => getComputedStyle(document.querySelector('.bc-onglets')).gridTemplateColumns.split(' ').length === 3), 'MOBILE : la barre d\'onglets passe à 3 colonnes (pas de case vide)');
  check(!/€|économique|pénalit/i.test(await texte(page)), nom + ' : aucun montant en euros ni mot « économique » sur Bilan de campagne');
  // Qualité du lait : reste complète, sans lien ni montant
  await ouvrirQualite(page);
  const q = await texte(page);
  check(!/€|Bilan économique|Prix du lait, bonus/i.test(q), nom + ' : Qualité du lait sans montant en euros ni lien « Bilan économique » : ' + q.replace(/\s+/g, ' ').slice(0, 300));
  check(await page.evaluate(() => !document.getElementById('pl-lien-eco') && !!document.getElementById('btn-rapport-qualite') && !!document.getElementById('btn-export-qualite-xlsx') && !!document.getElementById('btn-qualite-add')), nom + ' : exports et « Nouveau prélèvement » toujours là, pas de lien économique');
  // La Qualité est la MÊME qu'avec le réglage actif, au lien près (tout le reste : prélèvements, Super A, grades, exports, reste identique)
  await page.evaluate(() => { DB.bilanEconomiqueActif = true; }); await ouvrirQualite(page);
  const qActif = (await texte(page)).replace(/Prix du lait, bonus et pénalités : Bilan économique/, '');
  await page.evaluate(() => { DB.bilanEconomiqueActif = false; }); await ouvrirQualite(page);
  const norm = t => t.replace(/\s+/g, ' ').trim();
  eq(norm(q), norm(qActif), nom + ' : texte de la Qualité du lait identique à celui du réglage actif, hors lien');
  // Accueil
  await page.evaluate(() => render('home'));
  check(!/€|Bilan économique/i.test(await texte(page)), nom + ' : Accueil sans montant en euros ni « Bilan économique »');
  // Rapport PDF : Qualité seule
  const pdf = await rapport(page), txt = pdf.mots.join(' ');
  check(/Qualité du lait/.test(txt) && !/Bilan économique|€|Pénalités|Montant/.test(txt), nom + ' : rapport PDF = Qualité du lait seule (aucun montant) : ' + txt.slice(0, 300));
  eq(await page.evaluate(() => window.__donneesPrix() === window.__avantReglage), true, nom + ' : aucune donnée de lait ou de prix supprimée');
  console.log('OK 2 ' + nom + ' : désactivé = onglet, lien, page PDF et montants masqués ; Qualité complète ; données intactes.');
  await page.context().close();
}

// ================= 3. réactivation dans Paramètres (PC et mobile), sans rien perdre
for (const pc of [false, true]) {
  const nom = pc ? 'PC' : 'MOBILE';
  const page = await ouvrir(pc);
  // compte qui a le Bilan économique (interrupteur disponible, voir test_bilan_eco_interrupteur) et qui l'a désactivé
  await page.evaluate(() => { DB.bilanEconomiqueActif = false; DB.bilanEconomiqueDisponible = true; parametresTab = 'exploitation'; parametresRubrique = 'exploitation'; render('parametres'); });
  await page.waitForSelector('#f-exp-bilan-eco');
  check(!(await page.isChecked('#f-exp-bilan-eco')), nom + ' : interrupteur « Afficher le Bilan économique » décoché');
  const sauvegardesAvant = await page.evaluate(() => window.__saves);
  await page.check('#f-exp-bilan-eco');
  eq(await page.evaluate(() => [DB.bilanEconomiqueActif, window.__saves > 0]), [true, true], nom + ' : activé et enregistré tout de suite');
  await page.evaluate(() => { bilanEconomiqueCampagneAffichee = 2025; });   // campagne qui porte les relevés du jeu
  await ouvrirBilan(page, 'economique');
  eq((await onglets(page)).includes(pc ? 'Bilan économique' : 'Économique'), true, nom + ' : l\'onglet revient');
  check(/€/.test(await texte(page)), nom + ' : les montants en euros reviennent, calculés sur les mêmes données');
  await ouvrirQualite(page);
  check(await page.evaluate(() => !!document.getElementById('pl-lien-eco')) === !pc, nom + ' : lien « Bilan économique » dans la Qualité mobile (le PC n\'en a pas)');
  const pdf = await rapport(page);
  check(/Bilan économique/.test(pdf.mots.join(' ')) && pdf.pages >= 2, nom + ' : le rapport PDF retrouve sa page économique');
  eq(await page.evaluate(() => window.__donneesPrix() === window.__avantReglage), true, nom + ' : données identiques avant désactivation et après réactivation');
  await page.evaluate(() => { parametresTab = 'exploitation'; parametresRubrique = 'exploitation'; render('parametres'); });
  await page.uncheck('#f-exp-bilan-eco');
  eq(await page.evaluate(() => [DB.bilanEconomiqueActif, DB.bilanEconomiqueDisponible, !!document.getElementById('f-exp-bilan-eco')]), [false, true, true], nom + ' : désactivable de nouveau, l\'interrupteur reste là');
  console.log('OK 3 ' + nom + ' : réactivation dans Paramètres sans rien perdre, et nouvelle désactivation.');
  await page.context().close();
}

// ================= 4. compte neuf : « faux » écrit explicitement à sa création
{
  const h = await demarrerHarnais();
  const dev = await h.ouvrir({ desktop: true });
  await h.inscrire(dev, 'eco-' + Date.now() + '@ovilog-audit-jetable.test', 'AuditTest12345!');
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn && currentView === 'premiere-configuration', { label: 'compte neuf', timeout: 30000 });
  await h.attendreServeur(dev.uid, 'meta', r => r.exists && r.data, 'meta du compte neuf');
  const meta = await h.serveur(dev.uid, 'meta');
  eq(meta.data.bilanEconomiqueActif, false, 'compte neuf : bilanEconomiqueActif = false sur le serveur');
  eq(meta.data.bilanEconomiqueDisponible, false, 'compte neuf : bilanEconomiqueDisponible = false sur le serveur (interrupteur absent)');
  // il saisit ensuite son premier relevé de tank : le Bilan économique ne doit PAS apparaître tout seul
  await dev.page.evaluate(() => { DB.laitTank = [{ date: '2026-10-02', quantite: 120 }]; bilanCampagneTab = 'incoherences'; render('bilan-campagne'); });
  check(!(await dev.page.evaluate(() => bilanEconomiqueActif())), 'compte neuf : après son premier relevé de tank, le Bilan économique reste masqué');
  console.log('OK 4 compte neuf : réglage explicitement faux, reste masqué après les premières données de lait.');
  await h.fin();
}
await browser.close();
console.log('OK test_bilan_economique_reglage');
