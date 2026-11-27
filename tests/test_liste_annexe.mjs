/* Liste annexe au document de circulation (étape 2, point 1 ; maquette validée le 24/11) : feuille A4 NOIR ET BLANC, PC seulement, documents de sortie.
   Contenu : départ (N° EDE, détenteur, adresse), arrivée (catégorie en mots, nom, n°, date et heure de chargement), animaux listés (n° national, n° de travail,
   catégorie, année de naissance), agneaux de boucherie par indicatif, totaux, signatures vides, « à joindre au document de circulation n° ____ » (aucun n°,
   aucun identifiant, aucun code officiel), pied « Ovilog — Liste annexe » + « Page X/Y », plusieurs pages pour une longue liste. Bloquée (message qui nomme
   l'animal) tant qu'un animal est « À vérifier » ; autorisée « À compléter » (cases vides). Rappel ambre quand la case ICA « risque » est cochée. Jeu fictif. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const donnees = () => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000045' });   // agneau né ici sans n° = compté avec cet indicatif
  DB.acheteurs = ['Coop Exemple', 'Abattoir Test', 'Éleveur Test'];
  DB.partenairesInfo = { 'Coop Exemple': { categorie: 'cooperative', numero: 'FR 12345999' }, 'Abattoir Test': { categorie: 'abattoir', numero: 'FR 12.000.001' }, 'Éleveur Test': { categorie: 'eleveur', numero: 'FR12000001' } };
  DB.produitsInfo = { ProdX: { delaiViande: 28, delaiAttente: 0 } };
  const b = (id, eid, mouvements, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements }, extra || {});
  DB.brebis = [
    b('b1', '250000004561001', [{ id: 'm1', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }], { statut: 'vendue', numeroCourtTravailSieol: '601', sanitaire: [{ id: 's1', produit: 'ProdX', date: '2026-11-05', delaiViandeJours: 28 }] }),
    b('b2', '250000004561002', [{ id: 'm2', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }], { statut: 'vendue', agnelages: [{ id: 'ag1', date: '2026-10-01', campagne: 2026, lambs: [
      { id: 'l1', eid: '250000004571001', sexe: 'Mâle', mouvements: [{ id: 'm11', type: 'Vendu', acheteur: 'Coop Exemple', date: '2026-11-10' }] },
      { id: 'l2', eid: '', sexe: 'Mâle', mouvements: [{ id: 'm12', type: 'Vendu', acheteur: 'Coop Exemple', date: '2026-11-10' }] },
      { id: 'l3', eid: '71003', sexe: 'Femelle', mouvements: [{ id: 'm13', type: 'Vendu', acheteur: 'Coop Exemple', date: '2026-11-10' }] }] }] }),
    b('b3', '250000004561003', [{ id: 'm3', type: 'Morte', cause: 'Mammite', date: '2026-11-12' }], { statut: 'morte' }),
    b('b4', '250000004561004', [{ id: 'm4', type: 'Autoconsommation', date: '2026-11-15' }], { statut: 'autoconsommée' }),
    b('b5', '250000004561005', [{ id: 'm5', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-08-15' }], { statut: 'vendue' }),
    b('b6', '250000004561006', [{ id: 'm6', type: 'Entrée', cause: 'Import Nouveaux animaux (achetée)', importNature: 'achat', provenance: 'Éleveur Test', date: '2026-11-03' }], { dateEntree: '2026-11-03' }),
    b('b7', '250000004561007', [{ id: 'm7', type: 'Entrée', cause: 'Import Nouveaux animaux (achetée)', importNature: 'inventaire', date: '2026-11-03' }], { dateEntree: '2026-11-03' }),
    b('b8', '250000004561008', [{ id: 'm9', type: 'Entrée', cause: 'Import Nouveaux animaux (achetée)', date: '2026-11-04' }], { dateEntree: '2026-11-04' }),
    b('b9', '250000004561009', [{ id: 'm10', type: 'Entrée', cause: 'Import Nouveaux animaux (née)', date: '2026-11-04' }], { dateEntree: '2026-11-04' })
  ];
  DB.beliers = [];
  DB.agnelles = [{ id: 'a1', eid: '250000009871001', origine: 'achetée', statut: 'active', dateEntree: '2026-11-02', sanitaire: [], notes: [], mouvements: [{ id: 'm8', type: 'Entrée', cause: 'Achat', date: '2026-11-02' }] }];
};
const browser = await chromium.launch(LAUNCH);
const erreurs = [];
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
page.on('pageerror', e => erreurs.push(e.message));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(() => { window.OvilogSync = window.OvilogSync || {}; window.OvilogSync.reglagesAdmin = () => ({ connu: true, data: { notificationEde: true, notifierAPartirDu: '2026-09-01' } }); });
await page.evaluate(donnees);
await page.evaluate(() => {
  Object.assign(DB.exploitation, { nom: 'Exploitation B', numeroCheptel: 'FR12345678', adresse: '1 chemin du Test', codePostal: '12000', commune: 'Commune-Test' });
  window.__f = []; saveOrShareBinaryFile = async (n, b) => { window.__f.push({ n, b: Array.from(b) }); };
});
// 1. contenu (fonction pure)
const d = await page.evaluate(() => donneesListeAnnexe(documentsCirculationCalcules({}).docs[0]));
eq(d.depart, { ede: 'FR 12 345 678', nom: 'Exploitation B', adresse: '1 chemin du Test, 12000 Commune-Test' }, 'départ : N° EDE, détenteur, adresse en 3 champs');
eq(d.arrivee, { categorie: 'Coopérative ou négociant', nom: 'Coop Exemple', numero: 'FR 12 345 999', chargement: '10/11/2026' }, 'arrivée : catégorie en mots, nom, n°, date de chargement (heure vide)');
eq(d.listes.map(r => [r.national, r.travail, r.categorie, r.annee]), [['FR 000045 61001', '601', 'Brebis · réforme', '2026'], ['FR 000045 61002', '–', 'Brebis · réforme', '2026']], 'listés : n° national, n° de travail (– sinon), catégorie, année');
eq([d.agneaux, d.totaux], [[{ indicatif: 'FR 000045', n: 3 }], { total: 5, listes: 2, agneaux: 3 }], 'agneaux par indicatif, totaux justes');
// 2. bouton dans la fiche (sortie, PC), PDF noir et blanc
await page.evaluate(() => { dcEtat.id = documentsCirculationCalcules({}).docs[0].doc.id; render('documents-circulation'); });
check(await page.isEnabled('#dc-annexe'), 'document « À compléter » : liste annexe autorisée');
await page.click('#dc-annexe');
check(/Imprimer quand même/.test(await page.textContent('#question-charte')) && /Manque :/.test(await page.textContent('#question-charte')), 'document « À compléter » : « Imprimer quand même ? » avec le manque');
await page.click('#qc-oui'); await page.waitForTimeout(150);
const f1 = await page.evaluate(() => window.__f[0]);
check(/^liste-annexe_2026-11-10_.+\.pdf$/.test(f1.n), 'nom de fichier : ' + f1.n);
const p1 = lirePdfMots(f1.b), t1 = p1.mots.join(' ');
for (const m of ['Liste annexe au document de circulation', 'à joindre au document de circulation n°', 'FR 12 345 678', 'Exploitation B', 'Coop Exemple', '10/11/2026', 'FR 000045 61001', '601', 'Brebis · réforme', 'Né(e) en', 'FR 000045 3', 'Total ovins : 5', 'Détenteur de départ', "Détenteur d'arrivée", 'Ovilog — Liste annexe', 'Page 1/1'])
  check(t1.includes(m), 'PDF : « ' + m + ' » présent');
check(!/\b(E|V) FR\d|\b0000000\d+\b|Modèle à faire valider|catégorie \d\d/.test(t1), 'PDF : ni identifiant, ni code officiel, ni mention « Modèle à faire valider »');
eq([p1.pages, p1.vert, p1.tailles[0]], [1, 0, [595, 842]], 'une page A4 portrait, noir et blanc (aucun pixel vert)');
eq(await page.evaluate(() => JSON.stringify(DB.documentsCirculation || null)), 'null', 'imprimer n\'écrit rien');
// 3. longue liste : plusieurs pages, en-tête répété, Page X/Y
const fLong = await page.evaluate(() => {
  for (let i = 0; i < 70; i++) DB.brebis.push({ id: 'z' + i, eid: '2500000045' + String(62000 + i), statut: 'vendue', numeroCourtTravailSieol: String(700 + i), agnelages: [], sanitaire: [], mouvements: [{ id: 'mz' + i, type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }] });
  const x = documentsCirculationCalcules({}).docs.find(y => y.partenaire === 'Coop Exemple' && y.doc.date === '2026-11-10');
  return { n: x.listes.length, b: Array.from(buildListeAnnexePdfBytes(x)) };
});
const pl = lirePdfMots(fLong.b), tl = pl.mots.join(' ');
check(pl.pages >= 2 && tl.includes('Page 1/' + pl.pages) && tl.includes('Page ' + pl.pages + '/' + pl.pages) && tl.includes('(suite)') && tl.includes('FR 000045 62069') && tl.includes('Total ovins : ' + (fLong.n + 3)), 'longue liste : ' + pl.pages + ' pages, suite, dernier animal et total');
await page.evaluate(() => { DB.brebis = DB.brebis.filter(b => !/^z/.test(b.id)); });
// 4. blocage : animal « À vérifier » (agneau de reproduction sans n° national ; indicatif inconnu)
await page.evaluate(() => { dcEtat.brouillon = { 'agneaux:l3:m13': 'reproduction' }; render('documents-circulation'); });
eq(await page.evaluate(() => [document.getElementById('dc-annexe').disabled, /71003/.test(document.getElementById('dc-a-verifier').textContent), /reste(nt)? compté/.test(document.getElementById('dc-a-verifier').textContent)]), [false, true, true], 'agneau à vérifier : avertissement qui le nomme, bouton jamais grisé');
const nAv = await page.evaluate(() => window.__f.length);
await page.click('#dc-annexe');
check(await page.isVisible('#question-charte') && /Imprimer quand même/.test(await page.textContent('#question-charte')), 'agneau à vérifier : « Imprimer quand même ? »');
await page.click('#qc-non');
eq(await page.evaluate(() => window.__f.length), nAv, 'Revenir = rien d\'imprimé');
await page.click('#dc-annexe'); await page.click('#qc-oui'); await page.waitForTimeout(150);
eq(await page.evaluate(() => window.__f.length), nAv + 1, '« Imprimer quand même » = PDF produit');
await page.evaluate(() => { dcEtat.brouillon = {}; DB.exploitation.indicatifMarquage = ''; render('documents-circulation'); });
eq(await page.evaluate(() => [document.getElementById('dc-annexe').disabled, /agneau sans n° \(mère/.test(document.getElementById('dc-a-verifier').textContent)]), [false, true], 'indicatif inconnu : avertissement, agneau nommé par sa mère');
await page.evaluate(() => { DB.exploitation.indicatifMarquage = '000045'; render('documents-circulation'); });
// 5. rappel ICA « risque »
check(!(await page.isVisible('#dc-ica-rappel')), 'pas de rappel ICA sans le choix « risque »');
await page.check('input[name="dc-ica"][value="risque"]'); await page.waitForTimeout(100);
eq(await page.textContent('#dc-ica-rappel'), "Joindre le document dédié à l'information sur la chaîne alimentaire, à remettre au détenteur d'arrivée.", '« risque » choisi : rappel ambre avant la validation');
// 6. achat : pas de liste annexe ; mobile : pas de bouton
const idA = await page.evaluate(() => documentsCirculationCalcules({}).docs.find(x => x.doc.sens === 'entree').doc.id);
await page.evaluate(id => { dcEtat.id = id; render('documents-circulation'); }, idA);
eq(await page.evaluate(() => !!document.getElementById('dc-annexe')), false, 'document d\'achat : pas de liste annexe');
const mob = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
mob.on('pageerror', e => erreurs.push(e.message));
await mob.goto(URL_APP, { waitUntil: 'load' }); await mob.waitForTimeout(300);
await mob.evaluate(() => { window.OvilogSync = window.OvilogSync || {}; window.OvilogSync.reglagesAdmin = () => ({ connu: true, data: { notificationEde: true, notifierAPartirDu: '2026-09-01' } }); });
await mob.evaluate(donnees);
await mob.evaluate(() => { dcEtat.id = documentsCirculationCalcules({}).docs[0].doc.id; render('document-circulation'); });
eq(await mob.evaluate(() => !!document.getElementById('dc-annexe')), false, 'mobile : pas de liste annexe (PC seulement)');
check(!erreurs.length, 'aucune erreur JS ' + erreurs.join(' | '));
await browser.close();
console.log('test_liste_annexe : OK');
