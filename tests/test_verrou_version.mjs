/* Verrou de version (27/11, avant la conversion des libellés) : (1) sans verrou, rien ne change et la conversion « Morte » → « Mort » n'a PAS lieu ;
   (2) le bouton de Paramètres › Administration refuse si cet appareil n'est pas à jour ; (3) activé, il est confirmé par le SERVEUR puis la sauvegarde
   et la conversion suivent ; (4) un appareil plus ancien consulte mais n'écrit plus rien (bandeau « Mise à jour obligatoire », rien d'envoyé) ;
   (5) un appareil d'avant ce code (sans jeton d'écriture) est refusé par la règle du serveur ; (6) aucune fiche sortie ne repasse « active »,
   même saisie sur un appareil resté bloqué puis mis à jour. Faux backend local (même règle que firestore.rules), comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';
const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const mail = 'verrou-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const ouvrirEnVersion = async (v, desktop) => {
  const d = await h.ouvrir({ desktop });
  await d.page.addInitScript(n => { window.__versionAppTest = n; }, v);
  await d.page.evaluate(n => { window.__versionAppTest = n; localStorage.setItem('__fakePersister', '1'); }, v);
  return d;
};
const pc = await ouvrirEnVersion(490, true);
await h.inscrire(pc, mail, MDP);
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
const uid = pc.uid;
// le verrou se gère depuis le compte ADMINISTRATEUR seul (document admins/<uid>, comme dans la console)
await h.ecrireServeur(uid, [{ type: 'set', path: 'admins/' + uid, data: { role: 'admin' } }]);
await pc.page.reload({ waitUntil: 'load' });
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn && contactAdministrateur(), { label: 'PC administrateur', timeout: 30000 });
await h.attendreServeur(uid, 'meta', r => r.data && r.data.schemaDonnees === 3, 'compte neuf (format 3)');
const ANCIEN = await pc.page.evaluate(() => Object.keys(CONVERSION_TYPES_MOUVEMENT).find(k => CONVERSION_TYPES_MOUVEMENT[k] === TYPE_MVT.MORT));
await pc.page.evaluate(ancien => {
  DB.campagneDebut = 2027; DB.campagneInitialisee = true; DB.campagneDateDemarrage = '2026-09-29';
  const f = (id, n, sortie, statut) => ({ id, eid: '2500000129' + String(60000 + n), statut: statut || 'active', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [],
    mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }].concat(sortie ? [sortie] : []) });
  DB.brebis = [f('b1', 1), f('b2', 2, { type: ancien, cause: 'Mammite', date: '2026-10-12' }, 'morte'), f('b3', 3, { type: 'Vente', acheteur: 'Acheteur C', date: '2026-10-15' }, 'vendue')];
  saveData(DB);
}, ANCIEN);
await h.attendreServeur(uid, 'brebis', r => Object.keys(r.docs || {}).length === 3, '3 brebis au serveur');
await h.attendreCalme(uid, 1500);
const statuts = async () => { const d = (await h.fiches(uid, 'brebis')).docs; return ['b1', 'b2', 'b3'].map(id => d[id] && d[id].statut); };
const typeB2 = async () => { const d = (await h.fiches(uid, 'brebis')).docs; return (d.b2.mouvements || []).map(m => m.type).pop(); };

// ===== 1. sans verrou : la conversion attend, une écriture sans jeton passe encore (comportement d'avant)
const r1 = await pc.page.evaluate(async () => { sauvegardeVisibleAvantMutation = async () => ({ ok: true }); return convertirLibellesMouvements(); });
eq([r1.fait, /verrou/.test(r1.raison || '')], [false, true], 'sans verrou : aucune conversion');
eq(await typeB2(), ANCIEN, 'serveur : ancien libellé encore là');
check(await pc.page.evaluate(() => !document.getElementById('question-charte')), 'aucune question de sauvegarde avant le verrou');
const ecrireSansJeton = (data, client) => fetch('http://127.0.0.1:' + h.port + '/batch', { method: 'POST', body: JSON.stringify({ uid, clientId: client || 'ancien-appareil', ops: [{ type: 'update', path: 'users/' + uid + '/brebis/b1', data }] }) });
eq((await ecrireSansJeton({ note: 'avant verrou' })).status, 200, 'sans verrou : écriture sans jeton acceptée');
console.log('OK 1 sans verrou : pas de conversion, rien de changé pour les appareils.');

// ===== 2. bouton : refus si cet appareil n'est pas à jour, ou si la vérification échoue
const ouvrirAdministration = () => pc.page.evaluate(() => { parametresTab = 'administration'; render('parametres'); });
await ouvrirAdministration();
check(await pc.page.evaluate(() => !!document.getElementById('card-verrou-version') && /Désactivé/.test(document.getElementById('verrou-etat').textContent)), 'Administration : carte « Verrou de version », désactivé');
for (const [rel, attendu] of [[{ ok: true, best: { versionCode: 492 } }, /pas à jour.*1\.0\.490.*1\.0\.492/], [{ ok: false, best: null }, /Impossible de vérifier/]]) {
  await pc.page.evaluate(r => { derniereReleaseDisponible = async () => r; document.getElementById('btn-verrou-version').click(); }, rel);
  await h.attendre(pc, () => !!document.getElementById('message-charte'), { label: 'message de refus' });
  const t = await pc.page.evaluate(() => { const q = document.getElementById('message-charte'); const t = q.textContent; q.querySelector('button').click(); return t; });
  check(attendu.test(t), 'refus : ' + t);
}
eq((await h.serveur(uid, 'verrouVersion')).docs || {}, {}, 'refusé : aucun verrou écrit');
console.log('OK 2 bouton refusé si l\'appareil n\'est pas à jour ou si la vérification échoue.');

// appareils du compte : un mobile à jour (490), un mobile resté en 480
const mob = await ouvrirEnVersion(490, false);
await h.connecter(mob, mail, MDP);
await h.attendre(mob, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'mobile 490 lit le compte', timeout: 30000 });
const vieux = await ouvrirEnVersion(480, false);
await h.connecter(vieux, mail, MDP);
await h.attendre(vieux, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'mobile 480 lit le compte', timeout: 30000 });
await h.attendreCalme(uid, 1500);
const clientVieux = await h.clientId(vieux);

// ===== 3. activation : confirmée par le serveur, puis sauvegarde, puis conversion
await ouvrirAdministration();
await pc.page.evaluate(() => { derniereReleaseDisponible = async () => ({ ok: true, best: { versionCode: 490 } }); document.getElementById('btn-verrou-version').click(); });
await h.attendre(pc, () => /Activer le verrou de version/.test((document.getElementById('question-charte') || {}).textContent || ''), { label: 'question d\'activation' });
await pc.page.evaluate(() => document.querySelector('#question-charte .btn-primary').click());
await h.attendre(pc, () => /Correction des libellés/.test((document.getElementById('question-charte') || {}).textContent || ''), { label: 'sauvegarde demandée APRÈS le verrou', timeout: 30000 });
const verrouServeur = (await h.serveur(uid, 'verrouVersion')).docs.courant;
eq(verrouServeur && verrouServeur.versionMinimale, 490, 'verrou au serveur AVANT la sauvegarde : version minimale 490');
eq((await h.serveur(uid, 'meta')).data.schemaDonnees, 4, 'format du compte à 4 avant la sauvegarde (appareils d\'avant ce code arrêtés)');
eq(await typeB2(), ANCIEN, 'rien de converti avant la sauvegarde');
await pc.page.evaluate(() => document.querySelector('#question-charte .btn-primary').click());
const debut = Date.now();
while (Date.now() - debut < 20000 && (await typeB2()) !== 'Mort') await h.dormir(200);
eq(await typeB2(), 'Mort', 'conversion faite et envoyée après la sauvegarde');
eq(await statuts(), ['active', 'morte', 'vendue'], 'aucun statut changé par la conversion');
check(await pc.page.evaluate(() => /Activé · version minimale 1\.0\.490/.test(document.getElementById('app').textContent)), 'carte : activé, 1.0.490');
console.log('OK 3 verrou confirmé par le serveur → sauvegarde → conversion ; statuts intacts.');

// ===== 4. appareil plus ancien (480) : consultation seule, bandeau « Mise à jour obligatoire », rien d'écrit ni d'envoyé
await h.attendre(vieux, () => ecrituresBloqueesVersion(), { label: 'mobile 480 bloqué', timeout: 20000 });
const nJ = (await h.journal(uid)).length;
const v4 = await vieux.page.evaluate(() => {
  const avant = localStorage.getItem(DB_KEY);
  const b = DB.brebis.find(x => x.id === 'b1'); b.notes = (b.notes || []).concat([{ texte: 'note du vieux', date: '2026-11-27' }]);
  const ok = saveData(DB);
  const verifie = enregistrerVerifie(null, 'Note', [['b1', 1]]);
  const bandeau = document.getElementById('sync-bandeau');
  return { ok, verifie, inchange: localStorage.getItem(DB_KEY) === avant, bandeau: !bandeau.hidden && bandeau.textContent, bouton: !!document.getElementById('sync-bandeau-maj'), question: (document.getElementById('question-charte') || {}).textContent || '', lecture: DB.brebis.length };
});
eq([v4.ok, v4.verifie, v4.inchange, v4.bouton, v4.lecture], [false, false, true, true, 3], 'mobile 480 : rien d\'enregistré, bouton « Mettre à jour », lecture possible');
check(/Mise à jour obligatoire/.test(v4.bandeau) && /Mise à jour obligatoire/.test(v4.question) && /1\.0\.490/.test(v4.question), 'bandeau et message « Mise à jour obligatoire » : ' + v4.bandeau + ' | ' + v4.question);
await h.dormir(2000);
check(!(await h.journal(uid)).slice(nJ).some(e => e.clientId === clientVieux), 'mobile 480 : aucune écriture envoyée');
console.log('OK 4 appareil plus ancien : consulte, n\'enregistre rien, n\'envoie rien, « Mise à jour obligatoire ».');

// ===== 5. appareil d'avant ce code : arrêté par le format du compte, et refusé par la règle du serveur
const avantCode = await h.ouvrir({ desktop: false });
await avantCode.page.evaluate(() => { schemaDonneesVersionCourante = () => 3; });   // un ancien code ne connaît que le format 3 et n'a pas de verrou
await h.connecter(avantCode, mail, MDP);
await h.attendre(avantCode, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'appareil d\'avant ce code', timeout: 30000 });
check(await avantCode.page.evaluate(() => donneesVerrouillees()), 'format 4 inconnu : l\'ancien code n\'envoie plus rien');
let refus = await ecrireSansJeton({ statut: 'active' });
eq(refus.status, 403, 'serveur : écriture sans jeton refusée');
check(/jeton/.test((await refus.json()).message), 'motif : sans jeton');
const avecVieuxJeton = await fetch('http://127.0.0.1:' + h.port + '/batch', { method: 'POST', body: JSON.stringify({ uid, clientId: 'ancien-appareil', ops: [
  { type: 'update', path: 'users/' + uid + '/brebis/b2', data: { statut: 'active' } }, { type: 'set', path: 'users/' + uid + '/ecritures/jeton', data: { vApp: 480, vEcrit: { __op: 'serverTimestamp' } } }] }) });
eq(avecVieuxJeton.status, 403, 'serveur : jeton d\'une version 480 refusé');
eq((await fetch('http://127.0.0.1:' + h.port + '/batch', { method: 'POST', body: JSON.stringify({ uid, clientId: 'ancien-appareil', ops: [{ type: 'delete', path: 'users/' + uid + '/brebis/b3' }] }) })).status, 403, 'serveur : suppression sans jeton refusée');
const abaisse = await fetch('http://127.0.0.1:' + h.port + '/batch', { method: 'POST', body: JSON.stringify({ uid, clientId: 'x', ops: [
  { type: 'set', path: 'users/' + uid + '/verrouVersion/courant', data: { versionMinimale: 470 } }, { type: 'set', path: 'users/' + uid + '/ecritures/jeton', data: { vApp: 490, vEcrit: { __op: 'serverTimestamp' } } }] }) });
eq(abaisse.status, 403, 'serveur : le verrou ne baisse jamais');
eq(await statuts(), ['active', 'morte', 'vendue'], 'aucune fiche repassée active au serveur');
console.log('OK 5 appareil d\'avant ce code : arrêté par le format 4, et refusé par la règle (sans jeton, vieux jeton, suppression) ; verrou jamais abaissé.');

// ===== 6. aucune fiche sortie ne repasse « active » : saisie d'un ancien code sur un appareil à jour, puis appareil bloqué mis à jour
const r6 = await pc.page.evaluate(() => {
  const b = DB.brebis.find(x => x.id === 'b2'); b.statut = 'active';   // ce qu'un ancien code faisait d'une brebis « Mort »
  b.notes = (b.notes || []).concat([{ texte: 'note après le verrou', date: '2026-11-27' }]);
  saveData(DB);
  return b.statut;
});
eq(r6, 'morte', 'PC : statut recalculé d\'après le dernier mouvement avant l\'envoi');
await h.attendreServeur(uid, 'brebis', () => true, '');
await h.attendreCalme(uid, 1500);
eq(await statuts(), ['active', 'morte', 'vendue'], 'serveur : b2 reste « morte »');
// le mobile 480 a gardé une saisie « active » faite hors ligne par l'ancien code (stockage de l'appareil), puis il est mis à jour en 490
await vieux.page.evaluate(() => { const db = JSON.parse(localStorage.getItem(DB_KEY)); db.brebis.find(x => x.id === 'b3').statut = 'active'; localStorage.setItem(DB_KEY, JSON.stringify(db)); });
await vieux.page.addInitScript(() => { window.__versionAppTest = 490; });
await vieux.page.reload({ waitUntil: 'load' });
await h.attendre(vieux, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3 && !ecrituresBloqueesVersion(), { label: 'mobile mis à jour', timeout: 30000 });
await vieux.page.evaluate(() => saveData(DB));
await h.dormir(1500); await h.attendreCalme(uid, 1500);
eq(await vieux.page.evaluate(() => DB.brebis.find(x => x.id === 'b3').statut), 'vendue', 'mobile mis à jour : la saisie « active » d\'une vendue est corrigée');
eq(await statuts(), ['active', 'morte', 'vendue'], 'serveur : aucune fiche repassée active');
check(await vieux.page.evaluate(() => document.getElementById('sync-bandeau').hidden || !/Mise à jour obligatoire/.test(document.getElementById('sync-bandeau').textContent)), 'mobile mis à jour : plus de « Mise à jour obligatoire »');
for (const d of [pc, mob, vieux, avantCode]) check(!d.erreurs.length, 'erreurs JS : ' + d.erreurs.slice(0, 3).join(' | '));
console.log('OK 6 aucune fiche sortie ne repasse « active » (avant envoi, et saisie hors ligne d\'un appareil bloqué puis mis à jour).');
await h.fin();
console.log('TOUS LES TESTS « VERROU DE VERSION » SONT PASSÉS (faux backend, comptes jetables, aucune donnée réelle)');
