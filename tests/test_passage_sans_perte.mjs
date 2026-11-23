/* Perte du 23/11 : un compte dont le rangement par versions est resté INACHEVÉ (fiches déjà rangées, champ el, marqueur jamais posé : la
   vérification des listes échouait à chaque ouverture). Une mise bas saisie pendant ce temps part en versions (el). À la réouverture, le
   rangement aboutit : il ne doit JAMAIS reconstruire une fiche déjà rangée d'après sa copie figée (gel), sinon la mise bas disparaît
   (serveur ET téléphone). Essai à blanc en échec = rien n'est écrit. lastSynced persisté par une version sans listesCompte : complété.
   Faux backend local, comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const mail = 'passage-perte-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';

const pc0 = await h.ouvrir({ desktop: true });
await h.inscrire(pc0, mail, MDP);
await h.attendre(pc0, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
const uid = pc0.uid;
await h.attendreServeur(uid, 'meta', r => r.exists, 'meta créé');
await h.attendreCalme(uid);
await pc0.ctx.close();

// téléphone (pas encore connecté) : sert à calculer le rangement « inachevé » posé sur le serveur, comme l'avait laissé la 1.0.463
const tel = await h.ouvrir();
const fiche = (id, eid, extra) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], sanitaire: [] }, extra);
const v1 = fiche('v1', '250000045651001', { numeroCourtTravailSieol: '501', agnelages: [{ date: '2026-11-19', campagne: 2027, codeRepro: null, lambs: [{ sexe: 'Mâle', eid: '250000045671001', pere: null }] }] });
const v2 = fiche('v2', '250000045651002', { numeroCourtTravailSieol: '564' });
const ranges = await tel.page.evaluate(fs => fs.map(f => { const g = rangementFicheV(JSON.parse(JSON.stringify(f)), 1795000000000); return Object.assign({}, f, { el: g.el, gel: g.gel, lp: g.lp }); }), [v1, v2]);
await h.ecrireServeur(uid, [
  { type: 'update', path: 'users/' + uid + '/meta/main', data: { schemaDonnees: 1, campagneDebut: 2027, campagneInitialisee: true, causesMortalite: ['Maladie'] } },
  ...['laitTank', 'journal', 'traitementsCollectifs', 'causesMortalite', 'causesMortaliteAgneaux', 'categoriesSoinsAutres', 'categoriesTraitements', 'categoriesNotes', 'motifsNonTraite', 'acheteurs', 'intervenants', 'produits', 'produitsInfo', 'resumesCampagne']
    .map(c => ({ type: 'delete', path: 'users/' + uid + '/listesCompte/' + c })),
  { type: 'set', path: 'users/' + uid + '/brebis/v1', data: ranges[0] },
  { type: 'set', path: 'users/' + uid + '/brebis/v2', data: ranges[1] }]);

// 1re ouverture : la vérification des listes échoue (comme en 1.0.463) → essai à blanc en échec, RIEN n'est écrit, pas de marqueur
// (l'appli peut se recharger à la connexion : le blocage est posé à chaque chargement tant que le drapeau du test est là)
await tel.page.addInitScript(() => { if (localStorage.getItem('__testBloquerListes') !== '1') return; const iv = setInterval(() => { if (typeof rangementVerifieV === 'function') { window.rangementVerifieV = () => false; clearInterval(iv); } }, 0); });
await tel.page.evaluate(() => { localStorage.setItem('__fakePersister', '1'); localStorage.setItem('__testBloquerListes', '1'); window.rangementVerifieV = () => false; });
await h.connecter(tel, mail, MDP);
await h.attendre(tel, () => (DB.brebis || []).length === 2, { timeout: 30000, label: 'le téléphone a les deux fiches' });
try { await h.attendre(tel, () => window.__etapeRangementVersions === 'essai à blanc en échec', { timeout: 30000, label: 'rangement : essai à blanc en échec' }); } catch (e) { console.log('étape', await tel.page.evaluate(() => [window.__etapeRangementVersions, DB.schemaDonnees, localStorage.getItem('__testBloquerListes')])); throw e; }
await h.attendreCalme(uid);
check(!((await h.serveur(uid, 'meta')).data.schemaDonnees >= 2), 'pas de marqueur posé');
check(!(await h.serveur(uid, 'listesCompte')).docs.causesMortalite, 'essai à blanc en échec : aucune liste écrite');

// la mise bas du matin, saisie pendant que le rangement est inachevé : elle part en versions sur la fiche déjà rangée
await tel.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'v2'); b.agnelages.push({ date: '2026-11-23', campagne: 2027, saisieA: Date.now(), lambs: [{ sexe: 'Mâle', eid: '250000045671281' }] }); saveData(DB); });
await (async () => { const d = Date.now(); while (Date.now() - d < 20000) { const f = await h.fiches(uid, 'brebis'); if (f.docs.v2.agnelages.length === 1) return; await h.dormir(150); } throw new Error('TIMEOUT : mise bas du matin sur le serveur'); })();
await h.attendreCalme(uid);

// réouverture : le rangement aboutit cette fois ; la fiche déjà rangée n'est pas reconstruite, la mise bas reste
await tel.page.evaluate(() => localStorage.removeItem('__testBloquerListes'));
await tel.page.reload({ waitUntil: 'load' });
await h.attendreServeur(uid, 'meta', r => r.data && r.data.schemaDonnees === 3, 'marqueur posé à la réouverture', 40000);
await h.attendreCalme(uid, 2500);
const lu = (await h.fiches(uid, 'brebis')).docs;
eq([lu.v1.agnelages.length, lu.v2.agnelages.length, (lu.v2.agnelages[0] || { lambs: [] }).lambs.map(l => l.eid)], [1, 1, ['250000045671281']], 'serveur : la mise bas saisie pendant le rangement inachevé est toujours là');
await h.attendre(tel, () => DB.schemaDonnees === 3 && DB.brebis.find(b => b.id === 'v2').agnelages.length === 1 && DB.brebis.find(b => b.id === 'v1').agnelages.length === 1, { timeout: 20000, label: 'téléphone : rien de perdu après le rangement' });
console.log('OK passage : une fiche déjà rangée n\'est jamais reconstruite d\'après sa copie figée ; essai à blanc en échec = rien d\'écrit.');

// lastSynced persisté par une version qui ne connaissait pas listesCompte (1.0.446) : complété au chargement, l'envoi repart
await h.attendreCalme(uid);
await tel.page.evaluate(uid => { const cle = 'ovilog_sync_last_synced_' + uid; const v = JSON.parse(localStorage.getItem(cle)); delete v.listesCompte; localStorage.setItem(cle, JSON.stringify(v)); }, uid);
const erreursAvant = tel.erreurs.length;
await tel.page.reload({ waitUntil: 'load' });
await h.attendre(tel, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 2, { timeout: 30000, label: 'téléphone rouvert' });
await h.dormir(1500);
await tel.page.evaluate(() => { DB.causesMortalite = (DB.causesMortalite || []).concat(['Prédateur']); saveData(DB); });
await h.attendreServeur(uid, 'listesCompte', r => JSON.stringify((r.docs || {}).causesMortalite || {}).includes('Prédateur'), 'ancien état de synchro sans listesCompte : la liste modifiée part quand même au serveur');
eq(tel.erreurs.slice(erreursAvant), [], 'aucune erreur de page');
await h.fin();
console.log('test_passage_sans_perte : OK');
