/* Rangement des fiches par versions (lot 4, livraison 2) : deux appareils hors réseau puis reconnectés, faux backend Firestore local, comptes
   jetables, aucune donnée réelle.
   A. Rangement d'un compte existant (fiches « à l'ancienne ») par le premier appareil à jour : el + gel sur chaque fiche, même contenu relu (deux
      notes identiques gardées), marqueur schemaDonnees = 2 ; un appareil qui ne connaît pas ce format n'écrit plus rien (bandeau).
   B. Écriture d'un appareil d'avant la livraison 1 (listes réécrites d'un bloc) : reprise sans contradiction, jamais de fusion muette.
   C. Même soin modifié des deux côtés : conflit des deux côtés, la plus récente à l'heure SERVEUR gagne (horloge d'appareil faussée sans effet),
      pastille Accueil, écran côte à côte, choix, Annuler, choix ; contrôle laitier pareil.
   D. Supprimé d'un côté, modifié de l'autre : la modification gagne ; mise bas supprimée pendant qu'on soigne un de ses agneaux : rétablie. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const mail = n => 'sync-versions-' + n + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const attendreFiches = async (uid, col, pred, label, timeout = 25000) => {
  const d = Date.now();
  let dernier;
  while (Date.now() - d < timeout) { dernier = await h.fiches(uid, col); if (pred(dernier)) return dernier; await h.dormir(150); }
  throw new Error('TIMEOUT côté serveur : ' + label + ' — ' + JSON.stringify(dernier).slice(0, 400));
};
const ficheLocale = (dev, id) => dev.page.evaluate(id => JSON.parse(JSON.stringify(DB.brebis.find(x => x.id === id) || null)), id);
const nConflits = dev => dev.page.evaluate(() => window.OvilogSync.conflits().length);

// ---------- A. rangement d'un compte existant ----------
{
  const pc0 = await h.ouvrir({ desktop: true });
  const m = mail('a');
  await h.inscrire(pc0, m, MDP);
  await h.attendre(pc0, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
  const uid = pc0.uid;
  await h.attendreServeur(uid, 'meta', r => r.exists, 'meta créé');
  await h.attendreCalme(uid);
  await pc0.ctx.close();      // l'appareil qui a créé le compte s'en va (un compte ne repasse jamais à un format plus ancien en vrai)
  // le compte redevient « d'avant » : fiches à l'ancienne posées directement sur le serveur, marqueur absent (comme un compte existant)
  const soin = (p, d) => ({ date: d, produit: p, type: 'Traitement', dose: '2 cc' });
  const fiche = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], sanitaire: [] }, extra);
  await h.ecrireServeur(uid, [
    { type: 'update', path: 'users/' + uid + '/meta/main', data: { schemaDonnees: 1, campagneDebut: 2027, campagneInitialisee: true,
      laitTank: [{ date: '2026-11-01', quantite: 310 }, { date: '2026-11-02', quantite: 320 }], causesMortalite: ['Maladie', 'Accident'], journal: [{ type: 'Tonte', date: '2026-11-05', note: '' }],
      produits: { vaccins: ['Vaccin A'], antibiotiques: [], antiparasitaires: [], antiinflammatoires: [], autres: [] }, resumesCampagne: { 2026: { misesBas: 12 } } } },
    ...['laitTank', 'journal', 'traitementsCollectifs', 'causesMortalite', 'causesMortaliteAgneaux', 'categoriesSoinsAutres', 'categoriesTraitements', 'categoriesNotes', 'motifsNonTraite', 'acheteurs', 'intervenants', 'produits', 'produitsInfo', 'resumesCampagne']
      .map(c => ({ type: 'delete', path: 'users/' + uid + '/listesCompte/' + c })),
    { type: 'set', path: 'users/' + uid + '/brebis/v1', data: fiche('v1', '250000045651001', { sanitaire: [soin('Produit A', '2026-11-01'), soin('Produit A', '2026-11-01')], notes: [{ date: '2026-11-02', texte: 'Même note' }, { date: '2026-11-02', texte: 'Même note' }],
      agnelages: [{ date: '2026-11-03', campagne: 2027, lambs: [{ sexe: 'Mâle', eid: '250000045661001', sanitaire: [soin('Produit B', '2026-11-04')] }, { sexe: 'Mort-né' }] }] }) },
    { type: 'set', path: 'users/' + uid + '/brebis/v2', data: fiche('v2', '250000045651002', { controleLaitier: [{ controle: 1, quantite: 900, campagne: 2027 }] }) }]);
  // un nouvel appareil se connecte au compte : il le lit, le range, vérifie, pose le marqueur
  const tel = await h.ouvrir();
  await h.connecter(tel, m, MDP);
  try { await h.attendreServeur(uid, 'meta', r => r.data && r.data.schemaDonnees === 3, 'marqueur schemaDonnees = 3 posé après vérification (fiches et listes du compte)', 40000); }
  catch (e) { console.log('étape du rangement (téléphone) :', await tel.page.evaluate(() => [window.__etapeRangementVersions, DB.schemaDonnees, window.OvilogSync.getState()])); throw e; }
  const brut = (await h.serveur(uid, 'brebis')).docs;
  check(brut.v1.el && brut.v1.gel && brut.v2.el, 'chaque fiche a reçu ses versions (el) et sa copie figée (gel)');
  check(Array.isArray(brut.v1.sanitaire) && brut.v1.sanitaire.length === 2, 'les listes à l\'ancienne restent lisibles telles quelles');
  const lu = await h.fiches(uid, 'brebis');
  eq([lu.docs.v1.sanitaire.length, lu.docs.v1.notes.length, lu.docs.v1.agnelages[0].lambs.length, lu.docs.v1.agnelages[0].lambs[0].sanitaire[0].produit, lu.docs.v2.controleLaitier[0].quantite],
    [2, 2, 2, 'Produit B', 900], 'relu après rangement : mêmes soins (2 identiques), mêmes notes (2 identiques), agneaux et soin d\'agneau, contrôle');
  const listes = (await h.serveur(uid, 'listesCompte')).docs;
  check(listes.laitTank && listes.laitTank.el && listes.causesMortalite && listes.journal && listes.produits && listes.resumesCampagne, 'chaque liste du compte a son document rangé par versions');
  const metaApres = (await h.serveur(uid, 'meta')).data;
  eq([metaApres.laitTank.length, metaApres.causesMortalite], [2, ['Maladie', 'Accident']], 'les listes du document principal restent telles quelles (lisibles par un appareil pas à jour)');
  await h.attendre(tel, () => DB.laitTank.length === 2 && DB.laitTank[1].quantite === 320 && DB.causesMortalite.join() === 'Maladie,Accident' && DB.journal.length === 1 && DB.produits.vaccins[0] === 'Vaccin A' && DB.resumesCampagne[2026].misesBas === 12, { label: 'le téléphone lit les listes du compte rangées, à l\'identique' });
  await h.attendre(tel, () => DB.schemaDonnees === 3 && DB.brebis.length === 2 && DB.brebis.find(b => b.id === 'v1').sanitaire.length === 2, { label: 'le téléphone voit le compte rangé, rien de perdu' });
  // appareil qui ne connaît pas ce format (livraison 1) : plus aucune écriture, bandeau
  await h.attendreCalme(uid);
  const pc = await h.ouvrir({ desktop: true });
  await pc.page.evaluate(() => { window.schemaDonneesVersionCourante = () => 2; });   // appli de la livraison 2 : ne connaît pas le format 3
  await h.connecter(pc, m, MDP);
  const clientPc = await h.clientId(pc);
  await h.attendre(pc, () => DB.schemaDonnees === 3 && (DB.brebis || []).length === 2, { timeout: 30000, label: 'le PC lit le compte et son marqueur' });
  await h.dormir(800);
  const avant = (await h.journal(uid)).length;
  await pc.page.evaluate(() => { DB.brebis.find(b => b.id === 'v2').notes.push({ date: '2026-11-20', texte: 'Note PC' }); saveData(DB); });
  await h.dormir(1500);
  const apres = (await h.journal(uid)).slice(avant).filter(e => e.clientId === clientPc);
  eq(apres.length, 0, 'appareil pas à jour : aucune écriture vers le compte');
  check(await pc.page.evaluate(() => window.__syncFormatRecent === true), 'appareil pas à jour : bandeau « Mettre à jour l\'application »');
  console.log('OK A : rangement (sauvegarde, versions, copie figée, relecture identique, doublons gardés, marqueur) ; appareil pas à jour bloqué.');

  // ---------- B. appareil d'avant la livraison 1 : il réécrit la liste des soins d'un bloc ----------
  const gel = brut.v1.gel;
  const leg = JSON.parse(JSON.stringify(gel.sanitaire));
  leg.push({ date: '2026-11-21', produit: 'Produit Ancien', type: 'Traitement' });
  await h.ecrireServeur(uid, [{ type: 'update', path: 'users/' + uid + '/brebis/v1', data: { sanitaire: leg } }]);
  await attendreFiches(uid, 'brebis', r => (r.docs.v1.sanitaire || []).some(s => s.produit === 'Produit Ancien'), 'soin de l\'ancien appareil repris');
  await h.attendreServeur(uid, 'brebis', r => JSON.stringify(r.docs.v1.gel.sanitaire) === JSON.stringify(leg), 'copie figée mise à jour : plus rien à reprendre');
  await h.attendre(tel, () => DB.brebis.find(b => b.id === 'v1').sanitaire.some(s => s.produit === 'Produit Ancien'), { label: 'le téléphone voit le soin repris' });
  eq(await nConflits(tel), 0, 'ancien appareil sans contradiction : aucun conflit');
  // liste du compte réécrite à l'ancienne dans meta par cet ancien appareil : la cause ajoutée est reprise
  await h.ecrireServeur(uid, [{ type: 'update', path: 'users/' + uid + '/meta/main', data: { causesMortalite: ['Maladie', 'Accident', 'Cause ancienne'] } }]);
  await h.attendre(tel, () => DB.causesMortalite.join() === 'Maladie,Accident,Cause ancienne', { label: 'cause ajoutée par l\'ancien appareil reprise' });
  await h.attendreServeur(uid, 'listesCompte', r => r.docs.causesMortalite && JSON.stringify(r.docs.causesMortalite.gel.items) === JSON.stringify(['Maladie', 'Accident', 'Cause ancienne']), 'copie figée de la liste mise à jour');
  eq(await nConflits(tel), 0, 'liste du compte reprise sans conflit');
  console.log('OK B : écritures d\'un appareil d\'avant la livraison 1 reprises (fiche et liste du compte, sans contradiction), aucune fusion muette.');
}

// ---------- C et D : deux appareils à jour, hors réseau ----------
{
  const pc = await h.ouvrir({ desktop: true });
  const m = mail('c');
  await h.inscrire(pc, m, MDP);
  await h.attendre(pc, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
  const uid = pc.uid;
  await pc.page.evaluate(() => {
    const soin = (p, d) => ({ date: d, produit: p, type: 'Traitement', dose: '2 cc' });
    DB.campagneDebut = 2027; DB.campagneInitialisee = true;
    const f = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], sanitaire: [] }, extra);
    DB.brebis = [f('c1', '250000045651011', { sanitaire: [soin('Produit A', '2026-11-01')], controleLaitier: [{ controle: 1, quantite: 900, campagne: 2027 }] }),
      f('d1', '250000045651012', { sanitaire: [soin('Produit B', '2026-11-02')], agnelages: [{ date: '2026-11-03', campagne: 2027, codeRepro: 'MN', lambs: [{ sexe: 'Femelle', eid: '' }] }] })];
    saveData(DB);
  });
  await attendreFiches(uid, 'brebis', r => r.docs.c1 && r.docs.d1 && r.docs.d1.agnelages && r.docs.d1.agnelages.length === 1, 'fiches c1 et d1 sur le serveur');
  await h.attendreCalme(uid);
  const tel = await h.ouvrir();
  await h.connecter(tel, m, MDP);
  await h.attendre(tel, () => (DB.brebis || []).length === 2 && DB.brebis.find(b => b.id === 'd1').agnelages.length === 1, { timeout: 30000, label: 'le téléphone reçoit les fiches' });
  await h.attendreCalme(uid);

  // C. même soin et même contrôle modifiés des deux côtés ; le PC a une horloge en avance d'un an (sans effet : c'est l'heure du serveur qui juge)
  await h.reseau(pc, { coupe: true }); await h.reseau(tel, { coupe: true });
  await pc.page.evaluate(() => { const vrai = Date.now; Date.now = () => vrai() + 365 * 86400000;
    const b = DB.brebis.find(x => x.id === 'c1'); b.sanitaire[0].dose = '1 cc'; b.controleLaitier[0].quantite = 800; saveData(DB); Date.now = vrai; });
  await tel.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'c1'); b.sanitaire[0].dose = '3 cc'; b.controleLaitier[0].quantite = 1000; saveData(DB); });
  await h.dormir(400);
  await h.reseau(pc, { coupe: false });
  await attendreFiches(uid, 'brebis', r => r.docs.c1.sanitaire[0].dose === '1 cc', 'la modification du PC arrive');
  await h.reseau(tel, { coupe: false });      // le téléphone arrive APRÈS au serveur : sa version est la plus récente
  await attendreFiches(uid, 'brebis', r => r.docs.c1.sanitaire[0].dose === '3 cc' && r.docs.c1.controleLaitier[0].quantite === 1000, 'la plus récente à l\'heure serveur (téléphone) gagne');
  await h.attendreCalme(uid);
  await h.attendre(pc, () => window.OvilogSync.conflits().length === 2, { label: 'PC : 2 conflits (soin, contrôle)' });
  await h.attendre(tel, () => window.OvilogSync.conflits().length === 2, { label: 'téléphone : 2 conflits' });
  eq((await ficheLocale(pc, 'c1')).sanitaire[0].dose, '3 cc', 'le PC affiche la version la plus récente');
  // pastille Accueil, écran côte à côte, choix de la version du PC (perdante), Annuler, puis choix confirmé
  await tel.page.evaluate(() => render('home'));
  check(/Conflits de synchro : 2/.test(await tel.page.textContent('#pastille-conflits')), 'pastille ambre sur l\'Accueil');
  await tel.page.click('#pastille-conflits');
  eq(await tel.page.evaluate(() => [currentView, document.querySelectorAll('.cf-carte').length, document.querySelectorAll('.cf-carte')[0].querySelectorAll('.cf-version').length]), ['conflits-synchro', 2, 2], 'écran : 2 conflits, 2 versions côte à côte');
  const carteSoin = await tel.page.evaluate(() => [...document.querySelectorAll('.cf-carte')].findIndex(c => /Soin/.test(c.textContent)));
  const txt = await tel.page.evaluate(i => document.querySelectorAll('.cf-carte')[i].textContent, carteSoin);
  check(/1 cc/.test(txt) && /3 cc/.test(txt) && /Affichée/.test(txt), 'les deux doses visibles, la version affichée marquée : ' + txt.slice(0, 200));
  const choisir = async () => tel.page.evaluate(i => { const c = document.querySelectorAll('.cf-carte')[i]; [...c.querySelectorAll('.cf-version')].find(v => /1 cc/.test(v.textContent)).querySelector('.cf-garder').click(); }, carteSoin);
  await choisir();
  check(/Choix enregistré/.test(await tel.page.textContent('.sup-snack')), 'bandeau « Choix enregistré · Annuler »');
  eq(await tel.page.evaluate(() => [DB.brebis.find(b => b.id === 'c1').sanitaire[0].dose, window.OvilogSync.conflits().length]), ['1 cc', 1], 'choix appliqué : version gardée, 1 conflit restant');
  await tel.page.click('#sup-snack-annuler');
  await h.attendre(tel, () => window.OvilogSync.conflits().length === 2 && DB.brebis.find(b => b.id === 'c1').sanitaire[0].dose === '3 cc', { label: 'Annuler : le conflit revient tel quel' });
  await h.attendreCalme(uid);
  await tel.page.evaluate(() => render('conflits-synchro'));
  const carteSoin2 = await tel.page.evaluate(() => [...document.querySelectorAll('.cf-carte')].findIndex(c => /Soin/.test(c.textContent)));
  await tel.page.evaluate(i => { const c = document.querySelectorAll('.cf-carte')[i]; [...c.querySelectorAll('.cf-version')].find(v => /1 cc/.test(v.textContent)).querySelector('.cf-garder').click(); }, carteSoin2);
  await attendreFiches(uid, 'brebis', r => r.docs.c1.sanitaire[0].dose === '1 cc', 'le choix part au serveur');
  await h.attendre(pc, () => window.OvilogSync.conflits().length === 1 && DB.brebis.find(b => b.id === 'c1').sanitaire[0].dose === '1 cc', { label: 'le PC reçoit le choix : conflit du soin levé' });
  const archive = await tel.page.evaluate(() => JSON.parse(localStorage.getItem('ovilog_conflits_resolus') || '[]'));
  check(archive.length >= 1 && JSON.stringify(archive[0].versions).includes('3 cc'), 'la version écartée reste archivée sur l\'appareil (sauvegarde automatique)');
  // Paramètres : la ligne des conflits
  await tel.page.evaluate(() => { parametresRubrique = 'sauvegarde'; render('parametres'); });
  const prm = await tel.page.evaluate(() => (document.getElementById('prm-conflits') || {}).textContent || '');
  check(/Conflits de synchro : 1/.test(prm), 'Paramètres › Synchro : la liste des conflits : ' + prm);
  console.log('OK C : même soin et même contrôle modifiés des deux côtés : heure serveur (horloge faussée sans effet), conflit des deux côtés, pastille, côte à côte, choix, Annuler, archive, Paramètres.');

  // D. supprimé d'un côté, modifié de l'autre ; mise bas supprimée pendant qu'on soigne son agneau
  await h.attendreCalme(uid);
  await h.reseau(pc, { coupe: true }); await h.reseau(tel, { coupe: true });
  await pc.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'd1'); b.sanitaire = []; b.agnelages = []; saveData(DB); });
  await tel.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'd1'); b.sanitaire[0].dose = '5 cc'; b.agnelages[0].lambs[0].sanitaire = [{ date: '2026-11-20', produit: 'Produit Agneau', type: 'Traitement' }]; saveData(DB); });
  await h.dormir(400);
  await h.reseau(pc, { coupe: false });
  await h.dormir(800);
  await h.reseau(tel, { coupe: false });
  const fin = await attendreFiches(uid, 'brebis', r => r.docs.d1.sanitaire.length === 1 && r.docs.d1.sanitaire[0].dose === '5 cc' && r.docs.d1.agnelages.length === 1, 'la modification gagne, la mise bas est rétablie');
  eq(fin.docs.d1.agnelages[0].lambs[0].sanitaire.map(s => s.produit), ['Produit Agneau'], 'le soin de l\'agneau est gardé');
  await h.attendreCalme(uid);
  await h.attendre(pc, () => DB.brebis.find(b => b.id === 'd1').agnelages.length === 1 && DB.brebis.find(b => b.id === 'd1').sanitaire[0].dose === '5 cc', { label: 'le PC voit la mise bas rétablie et le soin modifié' });
  const conflitsPc = await pc.page.evaluate(() => window.OvilogSync.conflits().filter(c => c.id === 'd1').map(c => c.l).sort());
  check(conflitsPc.includes('sanitaire') && conflitsPc.includes('agnelages'), 'conflits signalés : soin supprimé/modifié, mise bas rétablie : ' + JSON.stringify(conflitsPc));
  console.log('OK D : supprimé / modifié : la modification gagne ; mise bas supprimée mais agneau soigné ailleurs : rétablie ; conflits signalés.');
}
await h.fin();
console.log('test_sync_versions : OK');
