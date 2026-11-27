/* Document de circulation complet (étape 2, point 2 ; plan validé le 27/11) : modèle GDS Ovin-Caprin page 1 reproduit, NOIR ET BLANC, PC seulement, sortie.
   Vérifie : contenu (fonction pure donneesDocumentCirculation) — transporteur n° ou nom, chargement, camion vide, départ « Élevage » + N° EDE en cases,
   arrivée cochée d'après la catégorie du partenaire, totaux toujours écrits, n° nationaux dans les cases (indicatif + n°), agneaux par indicatif ;
   5 exemplaires titrés (4 si le partenaire est délégataire : pas de page « EDE départ ») ; cases ICA et signatures jamais remplies ; jamais « Modèle à faire
   valider » ni « Ovilog » (décision du 27/11, pied « Page X/Y » seul) ; au-delà de 36 reproducteurs (ou de 3 indicatifs) : « voir liste annexe jointe » et liste annexe après CHAQUE
   exemplaire ; bouton bloqué tant qu'un animal est « À vérifier » ; imprimer n'écrit rien ; aucun bouton sur mobile ni pour un achat. Jeu fictif.
   OVILOG_DC_PDF_SORTIE=<dossier> : écrit les PDF produits (relecture à l'œil). */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const sortiePdf = process.env.OVILOG_DC_PDF_SORTIE;
const garder = (nom, b) => { if (sortiePdf) writeFileSync(path.join(sortiePdf, nom), Buffer.from(b)); };
const donnees = () => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000045', nom: 'Exploitation B', numeroCheptel: 'FR12345678', siren: '732829320', adresse: '1 chemin du Test', codePostal: '12000', commune: 'Commune-Test' });
  DB.acheteurs = ['Coop Exemple', 'Abattoir Test', 'Particulier Test'];
  DB.partenairesInfo = { 'Coop Exemple': { categorie: 'cooperative', numero: 'FR 12345999', adresse: '2 route de la Coop', codePostal: '12100', commune: 'Ville-Test' }, 'Abattoir Test': { categorie: 'abattoir', numero: 'FR 12.000.001' }, 'Particulier Test': { categorie: 'particulier' } };
  const b = (id, eid, mouvements, extra) => Object.assign({ id, eid, statut: 'vendue', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements }, extra || {});
  DB.brebis = [
    b('b1', '250000004561001', [{ id: 'm1', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }], { numeroCourtTravailSieol: '601' }),
    b('b2', '250000004561002', [{ id: 'm2', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }], { agnelages: [{ id: 'ag1', date: '2026-10-01', campagne: 2026, lambs: [
      { id: 'l1', eid: '250000004571001', sexe: 'Mâle', mouvements: [{ id: 'm11', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }] },
      { id: 'l2', eid: '250000012371002', sexe: 'Mâle', mouvements: [{ id: 'm12', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }] },
      { id: 'l3', eid: '', sexe: 'Femelle', mouvements: [{ id: 'm13', type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }] }] }] }),
    b('b3', '250000004561003', [{ id: 'm3', type: 'Vente', acheteur: 'Particulier Test', date: '2026-11-12' }])
  ];
  DB.beliers = []; DB.agnelles = [];
};
const browser = await chromium.launch(LAUNCH);
const erreurs = [];
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
page.on('pageerror', e => erreurs.push(e.message));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(() => { window.OvilogSync = window.OvilogSync || {}; window.OvilogSync.reglagesAdmin = () => ({ connu: true, data: { notificationEde: true, notifierAPartirDu: '2026-09-01' } }); });
await page.evaluate(donnees);
await page.evaluate(() => { window.__f = []; saveOrShareBinaryFile = async (n, b) => { window.__f.push({ n, b: Array.from(b) }); }; });
// 1. contenu (fonction pure)
await page.evaluate(() => { window.docCoop = () => documentsCirculationCalcules({}).docs.find(x => x.partenaire === 'Coop Exemple'); });
await page.evaluate(() => { materialiserDocumentCirculation(docCoop(), { heure: '07:30', transporteurNom: 'Transports Exemple', transporteurNumero: 'T123456', immatriculation: 'AB-123-CD', camionVide: true }); });
const d = await page.evaluate(() => { const x = docCoop(); return donneesDocumentCirculation(x); });
eq(d.exemplaires.length, 5, '5 exemplaires');
eq(d.exemplaires[1], "Exemplaire à envoyer à l'EDE par le détenteur de départ dans les 7 jours", '2e exemplaire : EDE départ');
eq([d.transport.nom, d.transport.numero, d.transport.vehicule, d.transport.camionVide], ['Transports Exemple', 'T123456', 'AB123CD', true], 'transport : nom, n° (deux champs), immatriculation sans tirets, camion vide');
check(/^10\/11\/2026 à 07 h 30$/.test(d.transport.chargement), 'chargement : date et heure ' + d.transport.chargement);
eq([d.depart.coche, d.depart.ede, d.depart.siren, d.depart.nom, d.depart.codePostal, d.depart.commune], ['Elevage', '12345678', '', 'Exploitation B', '12000', 'Commune-Test'], 'départ : Élevage, N° EDE en 8 cases, pas de SIREN (n° EDE présent), nom, adresse');
eq([d.arrivee.coche, d.arrivee.numero, d.arrivee.nom, d.arrivee.adresse], ['Centre Rassemblement', '12345999', 'Coop Exemple', '2 route de la Coop'], 'arrivée : coopérative = Centre Rassemblement');
eq(d.totaux, { agneaux: 3, reproducteurs: 2, ovins: 5 }, 'totaux toujours écrits');
eq(d.reproducteurs, [['000045', '61001'], ['000045', '61002']], 'reproducteurs : indicatif + n° individuel dans les cases');
eq(d.agneaux, [{ indicatif: '000045', n: 2 }, { indicatif: '000123', n: 1 }], 'agneaux de boucherie par indicatif (sans n° = né ici)');
eq([d.annexe, d.autresInfos], [false, ''], 'pas de liste annexe');
eq(await page.evaluate(() => ['eleveur', 'cooperative', 'marche', 'abattoir', 'particulier', 'autre'].map(c => CASE_ARRIVEE_DC[c] || null)), ['Elevage', 'Centre Rassemblement', 'Marché', 'Abattoir', 'Particulier', null], 'case d\'arrivée par catégorie (Autre : aucune)');
eq(await page.evaluate(() => [nomTransporteurDc({ transporteur: 'Ancien 12345' }), numeroTransporteurDc({ transporteur: 'Ancien 12345' }), nomTransporteurDc({ transporteur: 'Ancien', transporteurNom: 'Nouveau' })]), ['Ancien 12345', '', 'Nouveau'], 'ancien champ « n° ou nom » repris dans le nom, jamais déduit en n°');
eq(await page.evaluate(() => { const ex = DB.exploitation, n = ex.numeroCheptel; ex.numeroCheptel = ''; const dd = donneesDocumentCirculation(docCoop()); ex.numeroCheptel = n; return [dd.depart.ede, dd.depart.siren]; }), [null, '732829320'], 'SIREN imprimé seulement sans n° EDE');
eq(await page.evaluate(() => { const i = DB.partenairesInfo['Coop Exemple']; i.siren = '732829320'; const a = donneesDocumentCirculation(docCoop()).arrivee.siren; const n = i.numero; i.numero = ''; const b = donneesDocumentCirculation(docCoop()).arrivee.siren; i.numero = n; delete i.siren; return [a, b]; }), ['', '732829320'], 'arrivée : SIREN seulement sans n°');
// 2. bouton dans la fiche, PDF
await page.evaluate(() => { dcEtat.id = docCoop().doc.id; render('documents-circulation'); });
check(await page.isEnabled('#dc-document-pdf'), 'bouton « Document de circulation (PDF) » actif');
const avantDoc = await page.evaluate(() => JSON.stringify(DB.documentsCirculation || null));
const savesAvant = await page.evaluate(() => window.__saves);
await page.click('#dc-document-pdf');
check(/Imprimer quand même/.test(await page.textContent('#question-charte')) && /chaîne alimentaire/.test(await page.textContent('#question-charte')), 'ICA non choisie : « Imprimer quand même ? »');
await page.click('#qc-oui'); await page.waitForTimeout(200);
const f1 = await page.evaluate(() => window.__f[window.__f.length - 1]);
check(/^document-circulation_2026-11-10_.+\.pdf$/.test(f1.n), 'nom de fichier : ' + f1.n);
garder('document_circulation_5_exemplaires.pdf', f1.b);
const p1 = lirePdfMots(f1.b), t1 = p1.mots.join(' ');
eq([p1.pages, p1.vert], [5, 0], '5 pages, noir et blanc');
for (const m of ['Document de circulation Ovin - Caprin', 'Exemplaire à garder par le détenteur de départ', "Exemplaire à envoyer à l'EDE par le détenteur de départ dans les 7 jours", 'Exemplaire à conserver par le transporteur',
  "Exemplaire à garder par le détenteur d'arrivée", "Exemplaire à envoyer à l'EDE par le détenteur d'arrivée dans les 7 jours", 'Transports Exemple', '10/11/2026 à 07 h 30', 'Exploitation B', 'Coop Exemple',
  'Commune-Test', 'Ville-Test', 'Page 1/5', 'Page 5/5', 'La signature est obligatoire'])
  check(t1.includes(m), 'PDF : « ' + m + ' » présent');
check(!/voir liste annexe jointe|Liste annexe au document/.test(t1), 'pas de liste annexe sous 36 animaux');
check(!/Ovilog|faire valider/i.test(t1), 'ni « Ovilog » ni mention « à faire valider » sur le document');
check(!/\b(10|31|32|40)\b.{0,3}(cat|code)/i.test(t1), 'aucun code officiel');
eq([await page.evaluate(() => JSON.stringify(DB.documentsCirculation || null)), await page.evaluate(() => window.__saves)], [avantDoc, savesAvant], 'imprimer n\'écrit rien');
// 3. partenaire délégataire : 4 exemplaires, sans « EDE départ »
const p2 = await page.evaluate(() => { DB.partenairesInfo['Coop Exemple'].delegataire = true; const x = docCoop(); const r = { ex: donneesDocumentCirculation(x).exemplaires, b: Array.from(buildDocumentCirculationPdfBytes(x)) }; delete DB.partenairesInfo['Coop Exemple'].delegataire; return r; });
eq(p2.ex.length, 4, 'délégataire : 4 exemplaires');
const tp2 = lirePdfMots(p2.b).mots.join(' ');
check(!tp2.includes("Exemplaire à envoyer à l'EDE par le détenteur de départ") && tp2.includes("Exemplaire à envoyer à l'EDE par le détenteur d'arrivée"), 'délégataire : page « EDE départ » retirée, ligne rouge du modèle gardée');
// 4. plus de 36 reproducteurs : 36 dans les cases, « voir liste annexe jointe », liste annexe après chaque exemplaire
const big = await page.evaluate(() => {
  for (let i = 0; i < 40; i++) DB.brebis.push({ id: 'z' + i, eid: '2500000045' + String(62000 + i), statut: 'vendue', agnelages: [], sanitaire: [], mouvements: [{ id: 'mz' + i, type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }] });
  const x = docCoop(), dd = donneesDocumentCirculation(x);
  const r = { n: dd.reproducteurs.length, annexe: dd.annexe, info: dd.autresInfos, tot: dd.totaux, nbAnnexe: pagesListeAnnexe(x).length, b: Array.from(buildDocumentCirculationPdfBytes(x)) };
  DB.brebis = DB.brebis.filter(bb => !/^z/.test(bb.id)); return r;
});
eq([big.n, big.annexe, big.info, big.tot.reproducteurs], [36, true, 'voir liste annexe jointe', 42], '42 reproducteurs : 36 dans les cases, renvoi à la liste annexe, total juste');
garder('document_circulation_avec_annexe.pdf', big.b);
const pb = lirePdfMots(big.b), tb = pb.mots.join(' ');
eq(pb.pages, 5 * (1 + big.nbAnnexe), 'liste annexe imprimée après chaque exemplaire');
check(!/Ovilog|faire valider/i.test(tb), 'annexe jointe : ni « Ovilog » ni mention « à faire valider »');
check(tb.includes('voir liste annexe jointe') && (tb.match(/Liste annexe au document de circulation/g) || []).length === 5 && tb.includes('FR 000045 62039'), 'annexe : 5 fois, dernier animal présent');
// 5. indicatifs : les 9 cases du modèle, puis la liste annexe
const ind = await page.evaluate(() => {
  const l = DB.brebis[1].agnelages[0].lambs, r = [];
  for (let i = 0; i < 8; i++) { const p = String(201 + i).padStart(6, '0'); l.push({ id: 'li' + i, eid: '2500' + p + '7100' + i, sexe: 'Mâle', mouvements: [{ id: 'mi' + i, type: 'Vente', acheteur: 'Coop Exemple', date: '2026-11-10' }] }); }
  let dd = donneesDocumentCirculation(docCoop()); r.push([dd.agneaux.length, dd.annexe, dd.totaux.agneaux, dd.agneaux[8].indicatif]);
  window.__ind = Array.from(buildDocumentCirculationPdfBytes(docCoop()));
  l.splice(10);   // 9 indicatifs
  dd = donneesDocumentCirculation(docCoop()); r.push([dd.agneaux.length, dd.annexe, dd.totaux.agneaux]);
  l.splice(3); return r;
});
eq(ind, [[9, true, 11, '000207'], [9, false, 10]], 'indicatifs : 9 dans les cases sans annexe ; 10 = 9 dans les cases + liste annexe, total juste');
garder('document_circulation_9_indicatifs.pdf', await page.evaluate(() => window.__ind));
// 5 bis. n° d'arrivée identique au n° de l'exploitation : « À vérifier », message, validation impossible
await page.evaluate(() => { DB.partenairesInfo['Coop Exemple'].numero = 'FR 12 345 678'; dcEtat.id = docCoop().doc.id; render('documents-circulation'); });
eq(await page.evaluate(() => { const x = docCoop(); return [x.etat, x.verifications.length, /est le même que celui de votre exploitation/.test(document.getElementById('dc-verifier').textContent), document.querySelector('#dc-entete .mb-pastille, #dc-entete [class*=pastille]').textContent.trim(), filtreDocumentDc(x, 'acompleter')]; }), ['averifier', 1, true, 'À vérifier', true], 'même n° des deux côtés : document À vérifier avec message');
await page.evaluate(() => { DB.partenairesInfo['Coop Exemple'].numero = 'FR 12345999'; render('documents-circulation'); });
check(!(await page.isVisible('#dc-verifier')), 'n° différents : pas de message');
// 5 ter. fiche : deux champs ; toucher au nom remplace l'ancien champ unique
const ui = await page.evaluate(() => {
  const x = docCoop(); const d = DB.documentsCirculation[x.doc.id]; d.transporteur = 'Ancien'; delete d.transporteurNom; render('documents-circulation');
  const avant = [document.getElementById('dc-transporteur').value, !!document.getElementById('dc-transporteur-numero')];
  const el = document.getElementById('dc-transporteur'); el.value = 'Transports B'; el.dispatchEvent(new Event('change'));
  const d2 = DB.documentsCirculation[docCoop().doc.id];
  return avant.concat([d2.transporteurNom, d2.transporteur === undefined, d2.transporteurNumero]);
});
eq(ui, ['Ancien', true, 'Transports B', true, 'T123456'], 'fiche : ancien champ repris dans le nom, n° à part, le nom saisi le remplace');
// 6. particulier : aucune case de catégorie hors « Particulier », pas de n°
const dp = await page.evaluate(() => donneesDocumentCirculation(documentsCirculationCalcules({}).docs.find(x => x.partenaire === 'Particulier Test')).arrivee);
eq([dp.coche, dp.numero, dp.numeroTexte], ['Particulier', null, ''], 'particulier : case Particulier, pas de n°');
// 7. blocage : agneau de reproduction sans n° national
await page.evaluate(() => { dcEtat.id = docCoop().doc.id; dcEtat.brouillon = { 'agneaux:l3:m13': 'reproduction' }; render('documents-circulation'); });
eq(await page.evaluate(() => [document.getElementById('dc-document-pdf').disabled, /^À vérifier/.test(document.getElementById('dc-a-verifier').textContent)]), [false, true], 'animal à vérifier : avertissement, bouton jamais grisé');
const nF = await page.evaluate(() => window.__f.length);
await page.click('#dc-document-pdf');
check(await page.isVisible('#question-charte') && /Imprimer quand même/.test(await page.textContent('#question-charte')), 'animal à vérifier : « Imprimer quand même ? »');
await page.click('#qc-oui'); await page.waitForTimeout(200);
const fAv = await page.evaluate(() => window.__f[window.__f.length - 1]);
eq(await page.evaluate(() => window.__f.length), nF + 1, '« Imprimer quand même » = PDF produit');
eq(await page.evaluate(() => { const x = documentsCirculationCalcules(dcEtat.brouillon).docs.find(y => y.partenaire === 'Coop Exemple'); return [donneesDocumentCirculation(x).totaux, x.aVerifier.length]; }), [{ agneaux: 2, reproducteurs: 3, ovins: 5 }, 1], 'imprimé quand même : l\'agneau à vérifier reste compté (case vide)');
// indicatif inconnu : nombre écrit, cases vides, total juste
eq(await page.evaluate(() => { dcEtat.brouillon = {}; const ex = DB.exploitation.indicatifMarquage; DB.exploitation.indicatifMarquage = ''; const dd = donneesDocumentCirculation(docCoop()); DB.exploitation.indicatifMarquage = ex; return [dd.agneaux, dd.totaux.agneaux]; }), [[{ indicatif: '000045', n: 1 }, { indicatif: '000123', n: 1 }, { indicatif: '', n: 1 }], 3], 'indicatif inconnu : nombre écrit, cases vides, total juste');
// n° identique : impression possible après question
await page.evaluate(() => { DB.partenairesInfo['Coop Exemple'].numero = 'FR 12 345 678'; render('documents-circulation'); });
await page.click('#dc-document-pdf');
check(/est le même que celui de votre exploitation/.test(await page.textContent('#question-charte')), 'n° identique : rappelé dans « Imprimer quand même ? »');
await page.click('#qc-non');
await page.click('#dc-valider');
check(/Valider quand même/.test(await page.textContent('#question-charte')), 'n° identique : « Valider quand même ? »');
await page.click('#qc-non');
await page.evaluate(() => { DB.partenairesInfo['Coop Exemple'].numero = 'FR 12345999'; });
await page.evaluate(() => { dcEtat.brouillon = {}; });
// 8. mobile : pas de bouton
const mob = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
mob.on('pageerror', e => erreurs.push(e.message));
await mob.goto(URL_APP, { waitUntil: 'load' }); await mob.waitForTimeout(300);
await mob.evaluate(() => { window.OvilogSync = window.OvilogSync || {}; window.OvilogSync.reglagesAdmin = () => ({ connu: true, data: { notificationEde: true, notifierAPartirDu: '2026-09-01' } }); });
await mob.evaluate(donnees);
await mob.evaluate(() => { dcEtat.id = documentsCirculationCalcules({}).docs[0].doc.id; render('document-circulation'); });
eq(await mob.evaluate(() => !!document.getElementById('dc-document-pdf')), false, 'mobile : pas de document PDF (PC seulement)');
check(!erreurs.length, 'aucune erreur JS ' + erreurs.join(' | '));
await browser.close();
console.log('test_document_circulation_pdf : OK');
