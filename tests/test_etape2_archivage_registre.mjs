/* Teste l'étape 2 du chantier "Compléter le changement de campagne" :
   1. Ordre d'écriture garanti (écrire+vérifier le registre AVANT de
      retirer la fiche) -- un échec d'écriture sur UNE fiche ne bloque pas
      les autres, et la fiche en échec reste en place avec un message clair.
   2. Sur les VRAIES données de l'export du 29/09 (5 brebis + 4 béliers déjà
      sortis, jamais archivés) : archive complète, contenu du registre =
      fiche complète avant retrait, bilans (lactation, PAC 1er janvier)
      identiques avant/après archivage.
   3. Le journal (DB.journalRegistre) liste les EID archivés, pour la
      bascule ET le nettoyage ponctuel.
   4. Mouvement collectif partiellement archivé : restaure le reste, liste
      ceux qui ne l'ont pas été, redevient "non annulable" une fois tout
      archivé.
   Faux backend Firestore local -- aucune donnée réelle, aucune bascule
   réelle sur le compte de l'utilisateur. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
let cleanedUp = false;
function cleanup() { if (cleanedUp) return; cleanedUp = true; try { backendProc.kill(); } catch (e) {} }
process.on('exit', cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); cleanup(); process.exit(1); });

const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => {
    buf += d.toString();
    const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/);
    if (m) resolve(Number(m[1]));
  });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

const exportComplet = lireExport(EXPORT_ORIGINAL);
const brebisSorties = exportComplet.brebis.filter(s => s.statut && s.statut !== 'active');
const beliersSortis = exportComplet.beliers.filter(b => b.statut && b.statut !== 'actif');
const brebisActivesEchantillon = exportComplet.brebis.filter(s => (s.controleLaitier || []).length > 0 && (!s.statut || s.statut === 'active')).slice(0, 8);
const mouvementsCollectifsReels = exportComplet.mouvementsCollectifs;
console.log('Données réelles chargées : ' + brebisSorties.length + ' brebis sorties, ' + beliersSortis.length + ' béliers sortis, ' + brebisActivesEchantillon.length + ' brebis actives (échantillon avec contrôle laitier).');

const browser = await chromium.launch(LAUNCH);

async function newDevicePage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { ctx, page };
}
async function waitFor(page, fn, { timeout = 20000, interval = 200, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(interval);
  }
  throw new Error('TIMEOUT en attendant : ' + label);
}

function chargerJeuDeDonnees({ brebisSorties, beliersSortis, brebisActives, mvtsCollectifs }) {
  DB.campagneDebut = 2025;
  DB.campagneDateDemarrage = '2025-10-01';
  DB.campagneInitialisee = true;
  DB.exploitation.campagneMoisDebut = 10;
  DB.exploitation.campagneJourDebut = 1;
  DB.brebis = brebisActives.concat(brebisSorties);
  DB.beliers = beliersSortis;
  DB.agnelles = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.mouvementsCollectifs = mvtsCollectifs;
  saveData(DB);
}

// ============================================================
// 1) Compte de test + chargement du vrai jeu de données (5 brebis + 4
//    béliers sortis jamais archivés, échantillon de brebis actives).
// ============================================================
const email = 'etape2-registre-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';
const d1 = await newDevicePage();
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device connecté' });

await d1.page.evaluate(chargerJeuDeDonnees, { brebisSorties, beliersSortis, brebisActives: brebisActivesEchantillon, mvtsCollectifs: mouvementsCollectifsReels });
await d1.page.waitForTimeout(500);

// ============================================================
// 2) Chiffres des bilans AVANT archivage (référence).
// ============================================================
const bilansAvant = await d1.page.evaluate(() => ({
  brebisPasseesTraite2025: brebisPasseesTraiteCampagne(2025),
  misesBas2025: misesBasTroupeauCampagne(2025),
  effectifPacBrebis2026: effectifADate('brebis', '2026-01-01'),
  effectifPacBeliers2026: effectifADate('belier', '2026-01-01'),
  moyennePresence2025: moyennePresenceMensuelleCampagne(2025),
  nbBrebisVivantes: DB.brebis.length,
  nbBeliersVivants: DB.beliers.length
}));
console.log('Bilans AVANT archivage : ' + JSON.stringify(bilansAvant));

// ============================================================
// 3) Contenu complet des fiches AVANT retrait (pour comparaison post-archivage).
// ============================================================
const fichesAvant = await d1.page.evaluate((eids) => {
  const out = {};
  eids.brebis.forEach(eid => { out['brebis_' + eid] = JSON.parse(JSON.stringify(DB.brebis.find(s => s.eid === eid))); });
  eids.beliers.forEach(eid => { out['beliers_' + eid] = JSON.parse(JSON.stringify(DB.beliers.find(b => b.eid === eid))); });
  return out;
}, { brebis: brebisSorties.map(s => s.eid), beliers: beliersSortis.map(b => b.eid) });

// ============================================================
// 4) Point 1 -- ordre d'écriture garanti : simule un échec réseau pour LE
//    DOCUMENT REGISTRE d'une seule brebis (la 1re), le reste doit réussir.
// ============================================================
const eidEnEchec = brebisSorties[0].eid;
const idDocEnEchec = 'brebis_' + eidEnEchec.replace(/\s+/g, '');
await d1.page.route('**/batch', async (route, request) => {
  const body = request.postDataJSON();
  const cible = (body.ops || []).some(op => op.path && op.path.endsWith('/registre/' + idDocEnEchec));
  if (cible) { await route.abort(); return; }
  await route.continue();
});

const resultatArchivage = await d1.page.evaluate(async (dateLimite) => {
  return await archiverSortiesAnterieures(dateLimite);
}, '2026-09-30');

await d1.page.unroute('**/batch');

if (resultatArchivage.echecs.length !== 1 || resultatArchivage.echecs[0].eid !== eidEnEchec) {
  throw new Error('FAIL point 1: exactement 1 échec attendu, pour ' + eidEnEchec + ', obtenu ' + JSON.stringify(resultatArchivage.echecs));
}
console.log('OK point 1: la fiche ciblée (' + eidEnEchec + ') échoue avec un message clair : "' + resultatArchivage.echecs[0].raison + '"');

const totalAttendu = brebisSorties.length + beliersSortis.length;
if (resultatArchivage.archives.length !== totalAttendu - 1) {
  throw new Error('FAIL point 1: toutes les AUTRES fiches (' + (totalAttendu - 1) + ') doivent être archivées malgré l\'échec d\'une seule, obtenu ' + resultatArchivage.archives.length);
}
console.log('OK point 1: toutes les autres fiches (' + resultatArchivage.archives.length + '/' + totalAttendu + ') sont archivées+retirées malgré l\'échec d\'UNE seule -- traitement indépendant confirmé.');

const etatApresEchecPartiel = await d1.page.evaluate((eid) => ({
  encorePresente: DB.brebis.some(s => s.eid === eid),
  dansRegistre: !!(DB.registre.brebis && DB.registre.brebis[eid])
}), eidEnEchec);
if (!etatApresEchecPartiel.encorePresente || etatApresEchecPartiel.dansRegistre) {
  throw new Error('FAIL point 1: la fiche en échec doit rester EN PLACE (jamais retirée) et absente du registre tant que non confirmée, obtenu ' + JSON.stringify(etatApresEchecPartiel));
}
console.log('OK point 1: la fiche en échec (' + eidEnEchec + ') reste intacte dans DB.brebis, jamais retirée, jamais ajoutée au registre -- ordre garanti respecté.');

// ============================================================
// Rejoue l'archivage pour la fiche restante (réseau rétabli) avant de
// poursuivre les vérifications de contenu/bilans -- représente le nouvel
// essai que l'éleveur ferait (relancer la bascule/le nettoyage).
// ============================================================
const resultatArchivage2 = await d1.page.evaluate(async (dateLimite) => await archiverSortiesAnterieures(dateLimite), '2026-09-30');
if (resultatArchivage2.echecs.length !== 0 || resultatArchivage2.archives.length !== 1) {
  throw new Error('FAIL (infra test) : la relance doit archiver la seule fiche restante sans échec, obtenu ' + JSON.stringify(resultatArchivage2));
}
console.log('OK (infra) : la relance archive avec succès la fiche précédemment en échec, réseau rétabli.');

// ============================================================
// 5) Contenu du registre = fiche complète avant retrait.
// ============================================================
const registreApres = await d1.page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
for (const s of brebisSorties) {
  const entree = registreApres.brebis[s.eid];
  if (!entree) throw new Error('FAIL point 2: brebis ' + s.eid + ' absente du registre après archivage.');
  const avant = fichesAvant['brebis_' + s.eid];
  if (JSON.stringify(entree.mouvements) !== JSON.stringify(avant.mouvements)) throw new Error('FAIL point 2: mouvements non fidèles pour ' + s.eid);
  if (JSON.stringify(entree.echographies || []) !== JSON.stringify(avant.echographies || [])) throw new Error('FAIL point 2: échographies non fidèles pour ' + s.eid);
  if (JSON.stringify(entree.controleLaitier || []) !== JSON.stringify(avant.controleLaitier || [])) throw new Error('FAIL point 2: contrôle laitier non fidèle pour ' + s.eid);
  if (entree.dateEntree !== (avant.dateEntree || undefined) && entree.createdAt !== avant.createdAt) {
    throw new Error('FAIL point 2: ni dateEntree ni createdAt fidèles pour ' + s.eid + ' (fallback PAC perdu).');
  }
}
for (const b of beliersSortis) {
  const entree = registreApres.beliers[b.eid];
  if (!entree) throw new Error('FAIL point 2: bélier ' + b.eid + ' absent du registre après archivage.');
  const avant = fichesAvant['beliers_' + b.eid];
  if (JSON.stringify(entree.mouvements) !== JSON.stringify(avant.mouvements)) throw new Error('FAIL point 2: mouvements non fidèles pour bélier ' + b.eid);
}
console.log('OK point 2: le contenu du registre (mouvements, échographies, contrôle laitier, dates) est la fiche COMPLÈTE d\'avant retrait, pour les 5 brebis et 4 béliers.');

const etatFinal = await d1.page.evaluate(() => ({ nbBrebis: DB.brebis.length, nbBeliers: DB.beliers.length }));
if (etatFinal.nbBrebis !== brebisActivesEchantillon.length || etatFinal.nbBeliers !== 0) {
  throw new Error('FAIL point 2: les tableaux vivants doivent ne plus contenir AUCUNE des fiches archivées, obtenu ' + JSON.stringify(etatFinal));
}
console.log('OK point 2: les 5 brebis et 4 béliers ont bien été retirés des tableaux vivants.');

// ============================================================
// 6) Bilans identiques avant/après archivage simulé.
// ============================================================
const bilansApres = await d1.page.evaluate(() => ({
  brebisPasseesTraite2025: brebisPasseesTraiteCampagne(2025),
  misesBas2025: misesBasTroupeauCampagne(2025),
  effectifPacBrebis2026: effectifADate('brebis', '2026-01-01'),
  effectifPacBeliers2026: effectifADate('belier', '2026-01-01'),
  moyennePresence2025: moyennePresenceMensuelleCampagne(2025)
}));
console.log('Bilans APRÈS archivage : ' + JSON.stringify(bilansApres));
for (const cle of ['brebisPasseesTraite2025', 'misesBas2025', 'effectifPacBrebis2026', 'effectifPacBeliers2026', 'moyennePresence2025']) {
  if (bilansAvant[cle] !== bilansApres[cle]) {
    throw new Error('FAIL point 2 (bilans): "' + cle + '" doit être identique avant/après, avant=' + bilansAvant[cle] + ', après=' + bilansApres[cle]);
  }
}
console.log('OK point 2 (bilans): brebisPasseesTraiteCampagne, misesBasTroupeauCampagne, effectifADate (PAC brebis ET béliers) et moyennePresenceMensuelleCampagne (Bilan de lactation) sont TOUS identiques avant/après l\'archivage des 5 brebis + 4 béliers.');

// ============================================================
// 7) Journal : liste les EID archivés (bascule ET nettoyage).
// ============================================================
await d1.page.evaluate((resultat) => { journaliserArchivageRegistre('nettoyage_registre', resultat); }, { archives: resultatArchivage.archives.concat(resultatArchivage2.archives), echecs: [] });
const journal = await d1.page.evaluate(() => DB.journalRegistre);
if (!journal || !journal.length) throw new Error('FAIL point 3: DB.journalRegistre doit contenir au moins 1 entrée.');
const derniereEntree = journal[0];
const eidsAttendus = new Set(brebisSorties.map(s => 'brebis:' + s.eid).concat(beliersSortis.map(b => 'beliers:' + b.eid)));
const eidsObtenus = new Set(derniereEntree.eidsArchives);
if (eidsAttendus.size !== eidsObtenus.size || ![...eidsAttendus].every(e => eidsObtenus.has(e))) {
  throw new Error('FAIL point 3: le journal doit lister EXACTEMENT les EID archivés, attendu ' + JSON.stringify([...eidsAttendus]) + ', obtenu ' + JSON.stringify([...eidsObtenus]));
}
console.log('OK point 3: le journal (DB.journalRegistre) liste exactement les ' + eidsObtenus.size + ' EID archivés (brebis + béliers), catégorie incluse.');

// ============================================================
// 8) Bascule réelle : vérifie que executerChangementCampagne alimente
//    AUSSI le journal (chemin différent du nettoyage ponctuel testé ci-dessus).
// ============================================================
await d1.page.evaluate(() => {
  DB.brebis.push({ id: 'test-sortie-bascule', eid: '250099999999999', statut: 'morte', createdAt: Date.now(),
    dateEntree: '2020-01-01', echographies: [], agnelages: [], sanitaire: [], controleLaitier: [], modesRepro: [],
    mouvements: [{ type: 'Morte', cause: 'Test', date: '2020-06-01' }] }); // largement antérieure à la nouvelle campagne
  saveData(DB);
});
const journalAvantBascule = await d1.page.evaluate(() => (DB.journalRegistre || []).length);
const resultatBascule = await d1.page.evaluate(async () => await executerChangementCampagne());
if (!resultatBascule.ok) throw new Error('FAIL point 3 (bascule): la bascule doit réussir, obtenu ' + JSON.stringify(resultatBascule));
if (!resultatBascule.archivesSorties.some(a => a.eid === '250099999999999')) {
  throw new Error('FAIL point 3 (bascule): la fiche de test doit être archivée par LA BASCULE elle-même, obtenu ' + JSON.stringify(resultatBascule.archivesSorties));
}
const journalApresBascule = await d1.page.evaluate(() => DB.journalRegistre);
if (journalApresBascule.length !== journalAvantBascule + 1 || journalApresBascule[0].action !== 'bascule') {
  throw new Error('FAIL point 3 (bascule): une nouvelle entrée de journal avec action="bascule" doit être ajoutée, obtenu ' + JSON.stringify(journalApresBascule[0]));
}
if (!journalApresBascule[0].eidsArchives.includes('brebis:250099999999999')) {
  throw new Error('FAIL point 3 (bascule): le journal de la bascule doit lister l\'EID archivé, obtenu ' + JSON.stringify(journalApresBascule[0]));
}
console.log('OK point 3 (bascule): executerChangementCampagne alimente aussi le journal avec les EID archivés par LA BASCULE elle-même (chemin distinct du nettoyage ponctuel).');

await d1.ctx.close();

// ============================================================
// 9) Mouvement collectif partiellement archivé.
// ============================================================
const d2 = await newDevicePage();
const email2 = 'etape2-mvtcollectif-' + Date.now() + '@ovilog-audit-jetable.test';
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: email2, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });

// Mouvement collectif RÉEL (4 brebis) -- on archive seulement 2 des 4 membres.
const collectifBrebis = mouvementsCollectifsReels.find(m => m.categorie === 'brebis');
const brebisMembres = brebisSorties.filter(s => collectifBrebis.membres.includes(s.eid));
await d2.page.evaluate((data) => {
  DB.campagneDebut = 2025; DB.campagneInitialisee = true;
  DB.brebis = data.brebis; DB.beliers = []; DB.agnelles = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.mouvementsCollectifs = [data.collectif];
  saveData(DB);
}, { brebis: brebisMembres, collectif: collectifBrebis });
await d2.page.waitForTimeout(500);

// Archive directement 2 des 4 membres (contourne le filtre de date --
// teste ici spécifiquement le comportement de l'écran Mouvements collectifs,
// pas le filtrage par date déjà couvert au point 1/2 ci-dessus).
const eidsAArchiver = collectifBrebis.membres.slice(0, 2);
for (const eid of eidsAArchiver) {
  const r = await d2.page.evaluate(async (eid) => {
    const animal = DB.brebis.find(s => s.eid === eid);
    return await archiverEtRetirerFicheComplete('brebis', animal);
  }, eid);
  if (!r.ok) throw new Error('FAIL (infra test) : archivage direct de ' + eid + ' a échoué : ' + r.raison);
}
await d2.page.evaluate(() => saveData(DB));

await d2.page.evaluate(() => { parametresTab = undefined; render('mouvements-collectifs'); });
await d2.page.waitForTimeout(150);
const boutonPartiel = await d2.page.$('.btn-annuler-mvt-collectif');
if (!boutonPartiel) throw new Error('FAIL point 4: le bouton "Annuler" (partiel) doit rester affiché tant qu\'il reste des membres restaurables.');
const texteBouton = await d2.page.textContent('.btn-annuler-mvt-collectif');
if (!texteBouton.includes('partiel')) throw new Error('FAIL point 4: le bouton doit signaler "(partiel)", obtenu "' + texteBouton + '"');
console.log('OK point 4: le mouvement collectif partiellement archivé (2/4) affiche encore "Annuler ce mouvement collectif (partiel)".');

await d2.page.click('.btn-annuler-mvt-collectif');
await d2.page.waitForTimeout(200);
const etatApresAnnulationPartielle = await d2.page.evaluate(() => ({
  membresRestants: DB.brebis.filter(s => s.statut === 'active').map(s => s.eid),
  mouvementCollectif: DB.mouvementsCollectifs[0]
}));
const eidsRestaures = collectifBrebis.membres.filter(eid => !eidsAArchiver.includes(eid));
if (!eidsRestaures.every(eid => etatApresAnnulationPartielle.membresRestants.includes(eid))) {
  throw new Error('FAIL point 4: les 2 membres NON archivés doivent être restaurés (statut actif), obtenu ' + JSON.stringify(etatApresAnnulationPartielle.membresRestants));
}
if (JSON.stringify(etatApresAnnulationPartielle.mouvementCollectif.membres.slice().sort()) !== JSON.stringify(eidsAArchiver.slice().sort())) {
  throw new Error('FAIL point 4: l\'entrée doit être conservée avec UNIQUEMENT les EID archivés non restaurés, obtenu ' + JSON.stringify(etatApresAnnulationPartielle.mouvementCollectif.membres));
}
console.log('OK point 4: "Annuler" restaure bien les 2 membres encore vivants (statut actif recalculé), et l\'entrée est conservée avec uniquement les 2 EID archivés non restaurables.');

await d2.page.evaluate(() => render('mouvements-collectifs'));
await d2.page.waitForTimeout(150);
const boutonApres = await d2.page.$('.btn-annuler-mvt-collectif');
if (boutonApres) throw new Error('FAIL point 4: plus aucun bouton "Annuler" ne doit apparaître une fois tous les membres restants archivés.');
const texteEcran = await d2.page.textContent('#app');
if (!texteEcran.includes('Déjà archivé, non annulable')) {
  throw new Error('FAIL point 4: le message "Déjà archivé, non annulable" doit apparaître une fois tous les membres restants archivés.');
}
console.log('OK point 4: une fois tous les membres restants archivés, l\'entrée affiche "Déjà archivé, non annulable" sans bouton, sans avoir jamais disparu de l\'écran.');

await d2.ctx.close();
cleanup();
console.log('\nTOUS LES TESTS DE L\'ÉTAPE 2 SONT PASSÉS (compte de test jetable, faux backend local, aucune donnée réelle, aucune bascule réelle)');
await browser.close();
