/* Le FORMAT du compte (meta.schemaDonnees, rangementVersionsDate) ne recule jamais. Cas réel (24/11) : un appareil resté éteint depuis avant le rangement
   (champ connu « null » dans son état de synchro, absent de sa base) rouvert sur un compte rangé : le champ vide passait pour « modifié ici » et effaçait le
   marqueur au serveur, puis l'ancienne version relançait le rangement et effaçait les saisies faites depuis. Ici : (1) l'appareil resté éteint ne l'efface plus,
   null et absent comptent pareil à la fusion ; (2) un marqueur effacé par un appareil pas à jour est remis par un appareil à jour.
   Faux backend local, comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';
const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const mail = 'format-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const pc = await h.ouvrir({ desktop: true });
await pc.page.evaluate(() => localStorage.setItem('__fakePersister', '1'));
await h.inscrire(pc, mail, MDP);
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
const uid = pc.uid;
await h.attendreServeur(uid, 'meta', r => r.data && r.data.schemaDonnees === 3, 'compte neuf rangé (format 3)');
await pc.page.evaluate(() => {
  DB.campagneDebut = 2027; DB.campagneInitialisee = true;
  DB.brebis = [{ id: 'b1', eid: '250000045651001', statut: 'active', createdAt: 1, agnelages: [{ date: '2026-11-10', campagne: 2027, lambs: [{ sexe: 'Femelle', eid: '250000045671001' }] }], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [], mouvements: [] }];
  saveData(DB);
});
await h.attendreCalme(uid, 2000);
// le PC « resté éteint depuis avant le rangement » : son état de synchro connaissait le marqueur VIDE (null), sa base ne l'a pas
await pc.page.addInitScript(uid => {
  if (localStorage.getItem('__testEteint') !== '1') return;
  localStorage.removeItem('__testEteint');
  const cle = 'ovilog_sync_last_synced_' + uid, ls = JSON.parse(localStorage.getItem(cle));
  ls.meta.schemaDonnees = null; ls.meta.rangementVersionsDate = null; localStorage.setItem(cle, JSON.stringify(ls));
  const db = JSON.parse(localStorage.getItem('troupeau_data_v1')); delete db.schemaDonnees; delete db.rangementVersionsDate; localStorage.setItem('troupeau_data_v1', JSON.stringify(db));
}, uid);
await pc.page.evaluate(() => localStorage.setItem('__testEteint', '1'));
const nAvant = (await h.journal(uid)).length;
await pc.page.reload({ waitUntil: 'load' });
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 1, { timeout: 30000, label: 'PC rouvert' });
await h.dormir(2500); await h.attendreCalme(uid, 2500);
eq((await h.serveur(uid, 'meta')).data.schemaDonnees, 3, 'appareil resté éteint : le marqueur de format reste 3 au serveur');
eq(await pc.page.evaluate(() => DB.schemaDonnees), 3, 'et l\'appareil le reprend');
const effaces = (await h.journal(uid)).slice(nAvant).some(e => (e.ops || []).some(op => /meta\/main$/.test(op.path || '') && (op.cles || []).includes('schemaDonnees')));
check(!effaces, 'aucune écriture du marqueur par l\'appareil resté éteint');
// un appareil pas à jour efface le marqueur au serveur : un appareil à jour le remet
await h.ecrireServeur(uid, [{ type: 'update', path: 'users/' + uid + '/meta/main', data: { schemaDonnees: null, rangementVersionsDate: null } }]);
await h.attendreServeur(uid, 'meta', r => r.data && r.data.schemaDonnees === 3, 'marqueur remis par l\'appareil à jour', 20000);
eq(await pc.page.evaluate(() => DB.schemaDonnees), 3, 'l\'appareil à jour garde le format');
await h.fin();
console.log('test_format_jamais_abaisse : OK');
