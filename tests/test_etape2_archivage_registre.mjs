/* Teste l'étape 2 du chantier "Compléter le changement de campagne" :
   1. Ordre d'écriture garanti (écrire+vérifier le registre AVANT de
      retirer la fiche) -- un échec d'écriture sur UNE fiche ne bloque pas
      les autres, et la fiche en échec reste en place avec un message clair.
   2. Archive complète, contenu du registre = fiche complète avant retrait,
      bilans (lactation, PAC 1er janvier) identiques avant/après archivage.
   3. Le journal (DB.journalRegistre) liste les EID archivés, pour la
      bascule ET le nettoyage ponctuel.
   4. Mouvement collectif partiellement archivé : restaure le reste, liste
      ceux qui ne l'ont pas été, redevient "non annulable" une fois tout
      archivé.
   Données : l'export RÉEL complet (toutes les brebis, tous les béliers, tout
   le registre, mouvements collectifs réels), migré dans la collection dédiée
   comme sur le compte réel. L'export ne contient pas forcément de sortie
   antérieure à la date limite (le registre a déjà été nettoyé) : un jeu
   FICTIF de sorties (brebis et béliers vendus ou morts avant la date limite,
   EID d'exemple 250 000456 0xxxxx) est ajouté pour que l'ordre
   registre-puis-retrait, les bilans et le journal soient toujours éprouvés ;
   le test affiche combien de sorties sont réelles et combien fictives.
   Toutes les vérifications portent sur des RELATIONS (fiche avant == entrée
   après, bilans avant == après, registre réel inchangé, cloud == local),
   jamais sur un chiffre de l'export écrit en dur.
   Faux backend Firestore local -- aucune donnée réelle n'est envoyée,
   aucune bascule réelle sur le compte de l'utilisateur. */
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
const DATE_LIMITE = '2026-09-30';
const dernierMvt = a => (a.mouvements || []).filter(m => m && m.date).sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0).pop();
const sortieAvantLimite = (a, actif) => (a.statut || actif) !== actif && !!dernierMvt(a) && dernierMvt(a).date < DATE_LIMITE;
const sortieApresLimite = (a, actif) => (a.statut || actif) !== actif && !sortieAvantLimite(a, actif);
const registreReel = exportComplet.registre || { brebis: {}, beliers: {}, agnelles: {} };
const nbRegistreReel = Object.values(registreReel).reduce((n, c) => n + Object.keys(c || {}).length, 0);

// Jeu FICTIF : sorties antérieures à la date limite, dans la campagne 2025 (contrôle laitier et mise bas 2025,
// présentes au 1er janvier 2026) pour que chaque bilan comparé dépende vraiment d'elles.
const ficheFictive = (eid, statut, sortie, extra = {}) => Object.assign({
  id: 'fictif-' + eid, eid, statut, createdAt: 1700000000000, dateEntree: '2022-03-01', sanitaire: [], notes: [],
  mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2022-03-01' }, sortie]
}, extra);
const brebisFictive = (eid, statut, sortie) => ficheFictive(eid, statut, sortie, {
  echographies: [{ type: 'Résultat', date: '2025-08-20', campagne: 2025, special: null, parasitisme: false, stade: '', agneaux: '2' }],
  agnelages: [{ date: '2025-11-20', lambs: [], campagne: 2025 }],
  controleLaitier: [{ quantite: 1800, date: '2025-12-10', campagne: 2025, controle: 1, anomalie: null }, { quantite: 1500, date: '2026-02-10', campagne: 2025, controle: 2, anomalie: null }],
  modesRepro: []
});
const COLLECTIF_FICTIF_ID = 'MC-fictif-vente';
const venteCollective = { type: 'Vente', date: '2026-06-15', cause: null, acheteur: 'Acheteur C', collectifId: COLLECTIF_FICTIF_ID };
const brebisFictives = [
  brebisFictive('250000004560901', 'vendue', venteCollective),
  brebisFictive('250000004560902', 'vendue', venteCollective),
  brebisFictive('250000004560903', 'vendue', venteCollective),
  brebisFictive('250000004560904', 'vendue', venteCollective),
  brebisFictive('250000004560905', 'morte', { type: 'Morte', cause: 'Pneumonie', date: '2026-03-10', acheteur: null })
];
const beliersFictifs = [
  ficheFictive('250000004560911', 'vendu', { type: 'Vente', cause: null, acheteur: 'Acheteur C', date: '2026-07-01' }),
  ficheFictive('250000004560912', 'vendu', { type: 'Vente', cause: null, acheteur: 'Acheteur C', date: '2026-07-01' }),
  ficheFictive('250000004560913', 'mort', { type: 'Mort', cause: 'Accident', date: '2026-01-15' })
];
const collectifFictif = { id: COLLECTIF_FICTIF_ID, date: '2026-06-15', createdAt: 1781500000000, type: 'Vente', categorie: 'brebis', acheteur: 'Acheteur C', cause: null, annulable: true, membres: brebisFictives.slice(0, 4).map(s => s.eid) };

const brebisJeu = exportComplet.brebis.concat(brebisFictives);
const beliersJeu = (exportComplet.beliers || []).concat(beliersFictifs);
const brebisSorties = brebisJeu.filter(s => sortieAvantLimite(s, 'active'));
const beliersSortis = beliersJeu.filter(b => sortieAvantLimite(b, 'actif'));
const nbReelsCandidats = exportComplet.brebis.filter(s => sortieAvantLimite(s, 'active')).length + (exportComplet.beliers || []).filter(b => sortieAvantLimite(b, 'actif')).length;
const sortiesApresLimiteReelles = exportComplet.brebis.filter(s => sortieApresLimite(s, 'active')).map(s => ({ categorie: 'brebis', eid: s.eid }))
  .concat((exportComplet.beliers || []).filter(b => sortieApresLimite(b, 'actif')).map(b => ({ categorie: 'beliers', eid: b.eid })));
console.log('Données RÉELLES chargées : ' + exportComplet.brebis.length + ' brebis, ' + (exportComplet.beliers || []).length + ' béliers, ' + nbRegistreReel + ' entrées de registre, '
  + (exportComplet.mouvementsCollectifs || []).length + ' mouvements collectifs ; ' + nbReelsCandidats + ' sortie(s) réelle(s) antérieure(s) au ' + DATE_LIMITE + ', '
  + sortiesApresLimiteReelles.length + ' sortie(s) réelle(s) postérieure(s) (jamais archivée(s)).');
console.log('Jeu FICTIF ajouté : ' + brebisFictives.length + ' brebis et ' + beliersFictifs.length + ' béliers sortis avant le ' + DATE_LIMITE + ' (dont un mouvement collectif de vente de 4 brebis).');

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

function chargerJeuDeDonnees({ brebis, beliers, agnelles, registre, mvtsCollectifs }) {
  DB.campagneDebut = 2025;
  DB.campagneDateDemarrage = '2025-10-01';
  DB.campagneInitialisee = true;
  DB.exploitation.campagneMoisDebut = 10;
  DB.exploitation.campagneJourDebut = 1;
  DB.brebis = brebis;
  DB.beliers = beliers;
  DB.agnelles = agnelles;
  DB.registre = registre;
  DB.mouvementsCollectifs = mvtsCollectifs;
  DB.registreCollectionMigree20260930 = false;
  localStorage.setItem('troupeau_data_v1', JSON.stringify(DB)); // contourne saveData : la migration se fait à la reconnexion, comme sur le compte réel
}

// ============================================================
// 1) Compte de test + chargement de l'export réel complet et du jeu fictif,
//    puis migration du registre dans la collection dédiée (état du compte réel).
// ============================================================
const email = 'etape2-registre-' + Date.now() + '@ovilog-audit-jetable.test';
const password = 'AuditTest12345!';
const d1 = await newDevicePage();
let uidD1 = null;
d1.page.on('request', r => { if (!uidD1 && r.url().includes('/batch')) { try { uidD1 = r.postDataJSON().uid; } catch (e) {} } });
await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device connecté' });
await d1.page.waitForTimeout(400);

await d1.page.evaluate(chargerJeuDeDonnees, { brebis: brebisJeu, beliers: beliersJeu, agnelles: exportComplet.agnelles || [], registre: registreReel, mvtsCollectifs: exportComplet.mouvementsCollectifs || [] });
await d1.page.evaluate(async ({ email, pw }) => {
  window.OvilogSync.deconnecterSansVider();
  await new Promise(r => setTimeout(r, 200));
  await window.OvilogSync.login(email, pw);
}, { email, pw: password });
await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'device reconnecté' });
await waitFor(d1.page, () => DB.registreCollectionMigree20260930 === true, { timeout: 30000, label: 'migration du registre réel dans la collection' });
await d1.page.evaluate(() => saveData(DB));
const docsCloud = async () => Object.values((await (await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uidD1 + '&col=registre')).json()).docs || {});
{
  const t0 = Date.now();
  while (Date.now() - t0 < 30000 && (!uidD1 || (await docsCloud()).length !== nbRegistreReel)) await d1.page.waitForTimeout(200);
}
if (!uidD1 || (await docsCloud()).length !== nbRegistreReel) throw new Error('FAIL (infra test) : la collection doit contenir autant de documents que le registre réel (' + nbRegistreReel + '), obtenu ' + (uidD1 ? (await docsCloud()).length : 'uid inconnu'));
console.log('OK (infra) : registre réel migré dans la collection dédiée (' + nbRegistreReel + ' documents = ' + nbRegistreReel + ' entrées de l\'export).');
const registreAvant = await d1.page.evaluate(() => JSON.parse(JSON.stringify(DB.registre)));
if (JSON.stringify(registreAvant) !== JSON.stringify(registreReel)) throw new Error('FAIL (infra test) : après migration, le registre local doit être exactement celui de l\'export.');

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
// Les fiches à archiver pèsent vraiment dans les bilans comparés (sinon « identiques » ne prouverait rien)
if (bilansAvant.brebisPasseesTraite2025 < brebisFictives.length || bilansAvant.misesBas2025 < brebisFictives.length || bilansAvant.effectifPacBrebis2026 < brebisFictives.length || bilansAvant.effectifPacBeliers2026 < beliersFictifs.length) {
  throw new Error('FAIL (infra test) : les sorties fictives doivent compter dans chaque bilan comparé, obtenu ' + JSON.stringify(bilansAvant));
}

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
//    DOCUMENT REGISTRE d'une seule brebis (une fictive, toujours présente), le reste doit réussir.
// ============================================================
const eidEnEchec = brebisFictives[4].eid;
const idDocEnEchec = 'brebis_' + eidEnEchec.replace(/\s+/g, '');
await d1.page.route('**/batch', async (route, request) => {
  const body = request.postDataJSON();
  const cible = (body.ops || []).some(op => op.path && op.path.endsWith('/registre/' + idDocEnEchec));
  if (cible) { await route.abort(); return; }
  await route.continue();
});

const resultatArchivage = await d1.page.evaluate(async (dateLimite) => {
  return await archiverSortiesAnterieures(dateLimite);
}, DATE_LIMITE);

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
if ((await docsCloud()).some(d => d.categorie === 'brebis' && d.eid === eidEnEchec)) throw new Error('FAIL point 1: la fiche en échec ne doit pas être dans la collection du cloud.');
const resultatArchivage2 = await d1.page.evaluate(async (dateLimite) => await archiverSortiesAnterieures(dateLimite), DATE_LIMITE);
if (resultatArchivage2.echecs.length !== 0 || resultatArchivage2.archives.length !== 1) {
  throw new Error('FAIL (infra test) : la relance doit archiver la seule fiche restante sans échec, obtenu ' + JSON.stringify(resultatArchivage2));
}
console.log('OK (infra) : la relance archive avec succès la fiche précédemment en échec, réseau rétabli.');
const apresLimiteRestees = await d1.page.evaluate(({ liste, avant }) => liste.filter(a => (a.categorie === 'brebis' ? DB.brebis : DB.beliers).some(x => x.eid === a.eid)
  && JSON.stringify((DB.registre[a.categorie] || {})[a.eid]) === JSON.stringify((avant[a.categorie] || {})[a.eid])).length, { liste: sortiesApresLimiteReelles, avant: registreAvant });
if (apresLimiteRestees !== sortiesApresLimiteReelles.length) throw new Error('FAIL point 1: une sortie réelle postérieure au ' + DATE_LIMITE + ' ne doit jamais être archivée (' + apresLimiteRestees + '/' + sortiesApresLimiteReelles.length + ' restées en place).');
console.log('OK point 1 (données réelles) : ' + sortiesApresLimiteReelles.length + ' sortie(s) réelle(s) postérieure(s) au ' + DATE_LIMITE + ' laissée(s) en place (fiche vivante gardée, entrée de registre inchangée).');

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
console.log('OK point 2: le contenu du registre (mouvements, échographies, contrôle laitier, dates) est la fiche COMPLÈTE d\'avant retrait, pour les ' + brebisSorties.length + ' brebis et ' + beliersSortis.length + ' béliers archivés.');

const etatFinal = await d1.page.evaluate(() => ({ brebis: DB.brebis.map(s => s.eid), beliers: DB.beliers.map(b => b.eid) }));
const archivesEids = new Set(brebisSorties.map(s => 'brebis:' + s.eid).concat(beliersSortis.map(b => 'beliers:' + b.eid)));
const attenduBrebis = brebisJeu.map(s => s.eid).filter(e => !archivesEids.has('brebis:' + e));
const attenduBeliers = beliersJeu.map(b => b.eid).filter(e => !archivesEids.has('beliers:' + e));
if (JSON.stringify(etatFinal.brebis.slice().sort()) !== JSON.stringify(attenduBrebis.slice().sort()) || JSON.stringify(etatFinal.beliers.slice().sort()) !== JSON.stringify(attenduBeliers.slice().sort())) {
  throw new Error('FAIL point 2: tableaux vivants après = avant moins les fiches archivées, ni plus ni moins (brebis ' + etatFinal.brebis.length + '/' + attenduBrebis.length + ', béliers ' + etatFinal.beliers.length + '/' + attenduBeliers.length + ')');
}
console.log('OK point 2: tableaux vivants après = avant moins les ' + archivesEids.size + ' fiches archivées (' + attenduBrebis.length + ' brebis et ' + attenduBeliers.length + ' béliers restent, toutes les fiches réelles actives comprises).');

for (const cat of Object.keys(registreAvant)) {
  for (const [eid, entree] of Object.entries(registreAvant[cat] || {})) {
    if (JSON.stringify(registreApres[cat][eid]) !== JSON.stringify(entree)) throw new Error('FAIL point 2: une entrée réelle du registre a changé pendant l\'archivage (' + cat + ').');
  }
}
const nbApres = Object.values(registreApres).reduce((n, c) => n + Object.keys(c || {}).length, 0);
if (nbApres !== nbRegistreReel + archivesEids.size) throw new Error('FAIL point 2: registre après = registre réel + fiches archivées, attendu ' + (nbRegistreReel + archivesEids.size) + ', obtenu ' + nbApres);
console.log('OK point 2 (données réelles) : les ' + nbRegistreReel + ' entrées réelles du registre sont intactes, registre après = ' + nbRegistreReel + ' + ' + archivesEids.size + ' archivées.');

const cloudApres = await docsCloud();
const cloudParId = new Map(cloudApres.map(d => [d.categorie + ':' + d.eid, d]));
const ecartsCloud = [];
for (const cat of Object.keys(registreApres)) for (const [eid, entree] of Object.entries(registreApres[cat] || {})) {
  const doc = cloudParId.get(cat + ':' + eid);
  if (!doc || JSON.stringify(doc.mouvements || []) !== JSON.stringify(entree.mouvements || []) || JSON.stringify(doc.controleLaitier || []) !== JSON.stringify(entree.controleLaitier || [])) ecartsCloud.push(cat);
}
if (cloudApres.length !== nbApres || ecartsCloud.length) throw new Error('FAIL point 2: collection du cloud == registre local, obtenu ' + cloudApres.length + ' documents pour ' + nbApres + ' entrées, ' + ecartsCloud.length + ' écart(s).');
console.log('OK point 2: la collection du cloud contient exactement le registre local (' + cloudApres.length + ' documents, mêmes mouvements et contrôles laitiers).');

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
console.log('OK point 2 (bilans): brebisPasseesTraiteCampagne, misesBasTroupeauCampagne, effectifADate (PAC brebis ET béliers) et moyennePresenceMensuelleCampagne (Bilan de lactation) sont TOUS identiques avant/après l\'archivage des ' + brebisSorties.length + ' brebis + ' + beliersSortis.length + ' béliers.');

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
  DB.brebis.push({ id: 'test-sortie-bascule', eid: '250000004560999', statut: 'morte', createdAt: Date.now(),
    dateEntree: '2020-01-01', echographies: [], agnelages: [], sanitaire: [], controleLaitier: [], modesRepro: [],
    mouvements: [{ type: 'Morte', cause: 'Test', date: '2020-06-01' }] }); // largement antérieure à la nouvelle campagne
  saveData(DB);
});
const journalAvantBascule = await d1.page.evaluate(() => (DB.journalRegistre || []).length);
const resultatBascule = await d1.page.evaluate(async () => await executerChangementCampagne());
if (!resultatBascule.ok) throw new Error('FAIL point 3 (bascule): la bascule doit réussir, obtenu ' + JSON.stringify(resultatBascule));
if (!resultatBascule.archivesSorties.some(a => a.eid === '250000004560999')) {
  throw new Error('FAIL point 3 (bascule): la fiche de test doit être archivée par LA BASCULE elle-même, obtenu ' + JSON.stringify(resultatBascule.archivesSorties));
}
const journalApresBascule = await d1.page.evaluate(() => DB.journalRegistre);
if (journalApresBascule.length !== journalAvantBascule + 1 || journalApresBascule[0].action !== 'bascule') {
  throw new Error('FAIL point 3 (bascule): une nouvelle entrée de journal avec action="bascule" doit être ajoutée, obtenu ' + JSON.stringify(journalApresBascule[0]));
}
if (!journalApresBascule[0].eidsArchives.includes('brebis:250000004560999')) {
  throw new Error('FAIL point 3 (bascule): le journal de la bascule doit lister l\'EID archivé, obtenu ' + JSON.stringify(journalApresBascule[0]));
}
console.log('OK point 3 (bascule): executerChangementCampagne alimente aussi le journal avec les EID archivés par LA BASCULE elle-même (chemin distinct du nettoyage ponctuel).');

// Mouvements collectifs RÉELS : tous leurs membres sont déjà au registre -> carte sans « Annuler », mention « archivés au registre »
const collectifsReels = exportComplet.mouvementsCollectifs || [];
const collectifReelBrebis = collectifsReels.find(m => m.categorie === 'brebis' && (m.membres || []).every(e => registreReel.brebis && registreReel.brebis[e]));
if (collectifReelBrebis) {
  await d1.page.evaluate(() => { parametresTab = undefined; mvMobEtat = { cat: 'brebis', type: '', q: '', nb: 20, etendu: true, ouverts: new Set(), message: '' }; render('inventaire'); });
  await d1.page.waitForTimeout(200);
  const carte = await d1.page.evaluate(id => { const c = document.querySelector('.mm-lot[data-lot="' + id + '"]'); return c ? { bouton: !!c.querySelector('.mm-annuler-lot'), texte: c.textContent } : null; }, collectifReelBrebis.id);
  if (!carte || carte.bouton || !carte.texte.includes('archivés au registre')) throw new Error('FAIL point 4 (données réelles): le mouvement collectif réel, entièrement archivé, doit s\'afficher sans « Annuler » avec « archivés au registre », obtenu ' + JSON.stringify(carte && { bouton: carte.bouton }));
  console.log('OK point 4 (données réelles) : le mouvement collectif réel de brebis (' + collectifReelBrebis.membres.length + ' membres, tous au registre) s\'affiche « archivés au registre », sans « Annuler ».');
} else console.log('INFO point 4 : l\'export n\'a pas de mouvement collectif de brebis entièrement archivé ; seule la partie fictive ci-dessous tourne.');

await d1.ctx.close();

// ============================================================
// 9) Mouvement collectif partiellement archivé (jeu FICTIF : 4 brebis vendues ensemble,
//    car un collectif réel n'a plus de membre vivant à restaurer).
// ============================================================
const d2 = await newDevicePage();
const email2 = 'etape2-mvtcollectif-' + Date.now() + '@ovilog-audit-jetable.test';
await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: email2, pw: password });
await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'device 2 connecté' });

// Mouvement collectif FICTIF (4 brebis) -- on archive seulement 2 des 4 membres.
const collectifBrebis = collectifFictif;
const brebisMembres = brebisFictives.filter(s => collectifBrebis.membres.includes(s.eid));
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

await d2.page.evaluate(() => { parametresTab = undefined; mvMobEtat = { cat: 'brebis', type: '', q: '', nb: 20, etendu: true, ouverts: new Set(), message: '' }; render('inventaire'); });
await d2.page.waitForTimeout(150);
const boutonPartiel = await d2.page.$('.mm-lot .mm-annuler-lot');
if (!boutonPartiel) throw new Error('FAIL point 4: le bouton "Annuler" de la carte du lot doit rester affiché tant qu\'il reste des membres restaurables.');
console.log('OK point 4: le mouvement collectif partiellement archivé (2/4) affiche encore "Annuler" sur sa carte (la confirmation annonce les animaux déjà archivés).');

await d2.page.click('.mm-lot .mm-annuler-lot');
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

await d2.page.evaluate(() => { mvMobEtat.etendu = true; render('inventaire'); });
await d2.page.waitForTimeout(150);
const boutonApres = await d2.page.$('.mm-lot .mm-annuler-lot');
if (boutonApres) throw new Error('FAIL point 4: plus aucun bouton "Annuler" ne doit apparaître une fois tous les membres restants archivés.');
const texteEcran = await d2.page.textContent('#app');
if (!texteEcran.includes('archivés au registre')) {
  throw new Error('FAIL point 4: la mention "archivés au registre" doit apparaître une fois tous les membres restants archivés.');
}
console.log('OK point 4: une fois tous les membres restants archivés, la carte du lot affiche "animaux archivés au registre" sans bouton, sans avoir jamais disparu de l\'écran.');

await d2.ctx.close();
cleanup();
console.log('\nTOUS LES TESTS DE L\'ÉTAPE 2 SONT PASSÉS (compte de test jetable, faux backend local, export réel lu en local seulement, aucune bascule réelle)');
await browser.close();
